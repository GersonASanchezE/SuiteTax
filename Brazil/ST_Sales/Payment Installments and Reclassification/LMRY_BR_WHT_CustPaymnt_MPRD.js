/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for Tools for Report                           ||
||                                                              ||
||  File Name: LMRY_BR_WHT_CustPaymnt_MPRD.js	                ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Apr 06 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
  *@NModuleScope Public

 */
define(['N/log', 'N/search', 'N/record', 'N/runtime', 'N/format', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './WTH_Library/LMRY_BR_WHT_CustPaymnt_LBRY'],
    function (log, search, record, runtime, format, library_mail, lbryBRPayment) {

        var LMRY_script = 'LatamReady - BR WHT Customer Payment MPRD';
        function getInputData() {
            var idLog = "";
            try {
                var transactions = [];
                idLog = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_br_custpayment_log' });
                log.error('idLog', idLog);
                var params = getParametersFromLog(idLog);
                log.error('params', JSON.stringify(params));
                var setup = lbryBRPayment.getSetupTaxSubsidiary(params['subsidiary']);
                log.error('setup', JSON.stringify(setup));

                if (params["transactions"] && setup['paymentform']) {
                    //Detalle de pagos { amountpaid : number, interest: number, penalty: number }
                    transactions = params["transactions"];
                    var idpayment = lbryBRPayment.createPayment(params, transactions, setup['paymentform']);
                    log.error('idpayment', idpayment);

                    record.submitFields({
                        type: 'customrecord_lmry_br_custpayment_log',
                        id: idLog,
                        values: {
                            'custrecord_lmry_br_custpaym_log_idpaymt': idpayment
                        },
                        options: {
                            disableTriggers: true
                        }
                    });

                    var accountingbooks = lbryBRPayment.getPaymentAccountingBooks(idpayment);

                    for (var id in transactions) {
                        transactions[id]['idpayment'] = idpayment;

                        transactions[id]['options'] = {
                            'accountingbooks': accountingbooks
                        };

                        Object.keys(setup).forEach(function (k) {
                            transactions[id]["options"][k] = setup[k];
                        });
                    }

                    log.error('transactions', transactions);
                }

                return transactions;

            } catch (err) {
                library_mail.sendemail('[ getInputData ]' + err, LMRY_script);
                if (idLog) {
                    var errObj = { "name": err.name, "message": err.message, "stack": err.stack };
                    record.submitFields({
                        type: "customrecord_lmry_br_custpayment_log",
                        id: idLog,
                        values: {
                            "custrecord_lmry_br_custpaym_log_error": JSON.stringify(errObj),
                            "custrecord_lmry_br_custpaym_log_status": "3"
                        },
                        options: {
                            disableTriggers: true
                        }
                    });
                }
            }
        }

        function map(context) {
            try {
                var key = context.key;
                log.error("key", key);
                key = key.split("-");

                var idInvoice = key[0];
                var instalmentNumber = key[1] || "";

                var mapValues = JSON.parse(context.value);
                log.error('mapValues', JSON.stringify(mapValues));

                var idPayment = mapValues['idpayment'];
                var amountPaid = parseFloat(mapValues['amountpaid']);
                var interest = parseFloat(mapValues["interest"]);
                var penalty = parseFloat(mapValues["penalty"]);

                var options = mapValues['options'];
                var reclassSubtypes = options['reclassSubtypes'];

                if (reclassSubtypes && reclassSubtypes.length) {
                    var paymentTaxResults = lbryBRPayment.createPaymentWhtTaxResults(idInvoice, instalmentNumber, idPayment, amountPaid, reclassSubtypes);
                    log.error('paymentTaxResults', JSON.stringify(paymentTaxResults));
                }

                //Se crea el invoice de Interes y Multas
                var idIntInvoice = lbryBRPayment.crearNotaDebitoInteresMulta(idInvoice, instalmentNumber, idPayment, interest, penalty, options);
                log.error("idIntInvoice", idIntInvoice);

                context.write({
                    key: idPayment,
                    value: { idInvoice: idInvoice, instalmentNumber: instalmentNumber, idIntInvoice: idIntInvoice, interest: interest, penalty: penalty, options: options }
                });

            } catch (err) {
                log.error('[ map ]', err);
                library_mail.sendemail('[ map ]' + err, LMRY_script);
            }
        }

        function reduce(context) {
            try {
                var idPayment = context.key;
                var reduceValues = context.values;
                log.error('reduceValues', JSON.stringify(reduceValues));

                var options = JSON.parse(reduceValues[0])['options'];
                var reclassSubtypes = options['reclassSubtypes'];
                var journalform = options['journalform'];

                var idjournal = '';

                if (reclassSubtypes && reclassSubtypes.length) {
                    idjournal = lbryBRPayment.createReclassJournalEntry(idPayment, reclassSubtypes, journalform);
                    log.error('idjournal', idjournal);
                }

                //Se recopilan los invoices de interes y multas creados y se guardan su montos para agregarlos al pago.
                var interestInvoices = {}, invoices = {};
                for (var i = 0; i < reduceValues.length; i++) {
                    if (reduceValues[i]) {
                        var obj = JSON.parse(reduceValues[i]);

                        var idInvoice = obj["idInvoice"]
                        var idIntInvoice = obj["idIntInvoice"];
                        var interest = obj["interest"] || 0.00;
                        var penalty = obj["penalty"] || 0.00;

                        if (idInvoice) {
                            if (!invoices[String(idInvoice)]) {
                                invoices[String(idInvoice)] = { "interest": 0.00, "penalty": 0.00 };
                            }

                            invoices[String(idInvoice)]["interest"] = invoices[String(idInvoice)]["interest"] + round2(interest);
                            invoices[String(idInvoice)]["penalty"] = invoices[String(idInvoice)]["penalty"] + round2(penalty);
                        }

                        if (idIntInvoice) {
                            interestInvoices[String(idIntInvoice)] = { amount: round2(interest) + round2(penalty) };
                        }
                    }
                }

                log.error("invoices", JSON.stringify(invoices));
                log.error("interestInvoices", JSON.stringify(interestInvoices));

                var brTransactionFields = lbryBRPayment.updateBRTransactionFields(invoices);
                log.error("brTransactionFields", JSON.stringify(brTransactionFields));

                //Se aplican los invoices de interes y multas al pago
                lbryBRPayment.applyInvoicesinPayment(idPayment, interestInvoices);

                context.write({
                    key: idPayment,
                    value: {
                        isSuccess: 'T', idjournal: idjournal, numberInvoices: Object.keys(invoices).length, numberPenalties: Object.keys(interestInvoices).length
                    }
                });

            } catch (err) {
                log.error('[ reduce ]', err);
                library_mail.sendemail('[ reduce ]' + err, LMRY_script);
                var idLog = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_br_custpayment_log' });
                if (idLog) {
                    var errObj = { "name": err.name, "message": err.message, "stack": err.stack };
                    record.submitFields({
                        type: "customrecord_lmry_br_custpayment_log",
                        id: idLog,
                        values: {
                            "custrecord_lmry_br_custpaym_log_error": JSON.stringify(errObj),
                            "custrecord_lmry_br_custpaym_log_status": "3"
                        },
                        options: {
                            disableTriggers: true
                        }
                    });
                }
            }
        }


        function summarize(context) {
            try {
                var totalRows = 0, totalSuccess = 0;
                var payments = [], journals = [], totalInvoices = 0, totalPenalties = 0;
                context.output.iterator().each(function (key, value) {
                    var objValue = JSON.parse(value);
                    var isSuccess = objValue.isSuccess;
                    if (isSuccess == 'T') {
                        payments.push(key);

                        var idjournal = objValue.idjournal;
                        var numberInvoice = objValue.numberInvoices || 0.0;
                        var numberPenalties = objValue.numberPenalties || 0.00;

                        journals.push(idjournal);

                        totalInvoices += parseInt(numberInvoice);
                        totalPenalties += parseInt(numberPenalties);
                        totalSuccess++;
                    }
                    totalRows++;
                    return true;
                });

                log.error('stage', 'Summary');
                log.error('totalRows', totalRows);
                log.error('totalSuccess', totalSuccess);
                log.error('payments', payments);
                log.error('journals', journals);
                log.error('totalInvoices', totalInvoices);
                log.error("totalPenalties", totalPenalties);

                var idLog = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_br_custpayment_log' });
                var idpayment = payments[0] || '';
                var status = (idpayment) ? '2' : '3';

                record.submitFields({
                    type: 'customrecord_lmry_br_custpayment_log',
                    id: idLog,
                    values: {
                        'custrecord_lmry_br_custpaym_log_status': status,
                    },
                    options: {
                        disableTriggers: true
                    }
                });
            }
            catch (err) {
                library_mail.sendemail('[ summarize ]' + err, LMRY_script);
                var idLog = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_br_custpayment_log' });
                if (idLog) {
                    var errObj = { "name": err.name, "message": err.message, "stack": err.stack };
                    record.submitFields({
                        type: "customrecord_lmry_br_custpayment_log",
                        id: idLog,
                        values: {
                            "custrecord_lmry_br_custpaym_log_error": JSON.stringify(errObj),
                            "custrecord_lmry_br_custpaym_log_status": "3"
                        },
                        options: {
                            disableTriggers: true
                        }
                    });
                }
            }
        }

        function getParametersFromLog(idLog) {
            var params = {};

            var FEAT_DPT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
            var FEAT_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
            var FEAT_LOC = runtime.isFeatureInEffect({ feature: "LOCATIONS" });

            var columns = [
                'custrecord_lmry_br_custpaym_log_subsid', 'custrecord_lmry_br_custpaym_customer', 'custrecord_lmry_br_custpaym_log_date',
                'custrecord_lmry_br_custpaym_log_employee', 'custrecord_lmry_br_custpaym_log_currency', 'custrecord_lmry_br_custpaym_log_aracc',
                'custrecord_lmry_br_custpaym_log_bankacc', 'custrecord_lmry_br_custpaym_log_period', 'custrecord_lmry_br_custpaym_log_data',
                'custrecord_lmry_br_custpaym_log_doctype', 'custrecord_lmry_br_custpaym_log_memo', 'custrecord_lmry_br_custpaym_log_segments',
                "custrecord_lmry_br_custpaym_log_paymmeth"
            ];

            if (FEAT_DPT == 'T' || FEAT_DPT == true) {
                columns.push('custrecord_lmry_br_custpaym_log_deparmen');
            }

            if (FEAT_CLASS == 'T' || FEAT_CLASS == true) {
                columns.push('custrecord_lmry_br_custpaym_log_class');
            }

            if (FEAT_LOC == 'T' || FEAT_LOC == true) {
                columns.push('custrecord_lmry_br_custpaym_log_location');
            }

            var result = search.lookupFields({
                type: 'customrecord_lmry_br_custpayment_log',
                id: idLog,
                columns: columns
            });


            params['customer'] = result['custrecord_lmry_br_custpaym_customer'][0]['value'];
            params['subsidiary'] = result['custrecord_lmry_br_custpaym_log_subsid'][0]['value'];
            var date = result['custrecord_lmry_br_custpaym_log_date'];
            date = format.parse({ value: date, type: format.Type.DATE });
            params['date'] = date;

            params['currency'] = result['custrecord_lmry_br_custpaym_log_currency'][0]['value'];
            params['exchangerate'] = 1.0;
            params['araccount'] = result['custrecord_lmry_br_custpaym_log_aracc'][0]['value'];

            var undepfunds = 'T';
            var bankaccount = result['custrecord_lmry_br_custpaym_log_bankacc'] || '';
            if (bankaccount && bankaccount.length) {
                undepfunds = 'F';
                params['bankaccount'] = result['custrecord_lmry_br_custpaym_log_bankacc'][0]['value'];
            }
            params['undepfunds'] = undepfunds;

            params['period'] = result['custrecord_lmry_br_custpaym_log_period'][0]['value'];

            var document = result['custrecord_lmry_br_custpaym_log_doctype'] || '';
            if (document && document.length) {
                params['document'] = document[0]['value'];
            }

            var department = result['custrecord_lmry_br_custpaym_log_deparmen'] || '';
            if (department && department.length) {
                params['department'] = department[0]['value'];
            }

            var class_ = result['custrecord_lmry_br_custpaym_log_class'] || '';

            if (class_ && class_.length) {
                params['class'] = class_[0]['value'];
            }

            var location = result['custrecord_lmry_br_custpaym_log_location'] || '';

            if (location && location.length) {
                params['location'] = location[0]['value'];
            }

            var csegments = result["custrecord_lmry_br_custpaym_log_segments"];
            if (csegments) {
                params["csegments"] = JSON.parse(csegments);
            }

            params['memo'] = result['custrecord_lmry_br_custpaym_log_memo'] || '';

            var paymentmethod = result['custrecord_lmry_br_custpaym_log_paymmeth'];
            if (paymentmethod && paymentmethod.length) {
                params['paymentmethod'] = paymentmethod[0]['value'];
            }
            var strTransactions = result['custrecord_lmry_br_custpaym_log_data'];

            if (strTransactions) {
                params['transactions'] = JSON.parse(strTransactions);
            }

            return params;
        }

        function round2(num) {
            return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-14) / 1e2);
        }

        function round4(num) {
            return parseFloat(Math.round(parseFloat(num) * 1e4 + 1e-14) / 1e4);
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        }
    });
