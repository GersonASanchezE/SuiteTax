/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
//LMRY_BR_WHT_CustPaymnt_LBRY.js
define(['N/log', 'N/search', 'N/transaction', 'N/runtime', 'N/record', 'N/format', '../Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
    function (log, search, transaction, runtime, record, format, library_mail) {

        var TAX_TYPE = 1;
        var MEMO_RECLASS = 'Reclassification - WHT';
        var MEMO_INTEREST = "Latam - Interest and Penalty";
        var MEMO_WHT = "(LatamTax -  WHT)";
        var LMRY_script = 'LatamReady - BR WHT Customer Payment LBRY';

        // SuiteTax
        var ST_FEATURE = false;

        function voidPayment(paymentObj) {
            try {
                var idPayment = paymentObj.id;
                if (idPayment) {
                    var isReversalVoidingActive = runtime.getCurrentScript().getParameter({ name: 'REVERSALVOIDING' });
                    var isVoided = paymentObj.getValue('voided');
                    log.error('isReversalVoidingActive', isReversalVoidingActive);
                    log.error('voided', paymentObj.getValue('voided'));
                    if (isVoided == 'F' && (isReversalVoidingActive == 'F' || isReversalVoidingActive == false)) {
                        var search_journals = search.create({
                            type: "journalentry",
                            filters: [
                                ["custbody_lmry_reference_transaction", "anyof", idPayment], "AND",
                                ["memomain", "startswith", MEMO_RECLASS], "AND",
                                ["linesequencenumber", "equalto", "0"], "AND",
                                ["memo", "doesnotstartwith", "VOID"]
                            ],
                            columns: ['internalid']
                        });

                        var results = search_journals.run().getRange(0, 10);
                        if (results.length) {
                            var idJournal = results[0].getValue('internalid');
                            transaction.void({
                                type: transaction.Type.JOURNAL_ENTRY,
                                id: idJournal
                            });
                        }

                        removeOtherChargesInBRTransactionFields(paymentObj);

                        var invoices = getOtherChargesTransactions(paymentObj);
                        for (var i = 0; i < invoices.length; i++) {
                            var idInvoice = invoices[i];
                            transaction.void({
                                type: transaction.Type.INVOICE,
                                id: idInvoice
                            });
                        }
                    }
                }
            } catch (err) {
                library_mail.sendemail('[ voidPayment ]' + err, LMRY_script);
            }
        }

        function beforeDeletePayment(paymentObj) {
            try {
                var idPayment = paymentObj.id;
                if (idPayment) {
                    deleteTaxResults(idPayment);
                    deleteJournals(idPayment);
                    removeOtherChargesInBRTransactionFields(paymentObj);
                }
            } catch (err) {
                library_mail.sendemail('[ beforeDeletePayment ]' + err, LMRY_script);
            }
        }

        function deleteTaxResults(recordId) {
            if (recordId) {
                var searchTaxResults = search.create({
                    type: 'customrecord_lmry_br_transaction',
                    filters: [
                        ['custrecord_lmry_br_transaction', 'anyof', recordId], 'AND',
                        ['custrecord_lmry_tax_type', 'anyof', TAX_TYPE]
                    ],
                    columns: ['internalid']
                });

                var results = searchTaxResults.run().getRange(0, 1000);
                if (results) {
                    for (var i = 0; i < results.length; i++) {
                        var internalid = results[i].getValue('internalid');
                        record.delete({
                            type: 'customrecord_lmry_br_transaction',
                            id: internalid
                        });
                    }
                }
            }
        }

        function deleteJournals(recordId) {
            var search_journals = search.create({
                type: "journalentry",
                filters: [
                    ["custbody_lmry_reference_transaction", "anyof", recordId], "AND",
                    ["memomain", "startswith", MEMO_RECLASS]
                ],
                columns: ['internalid']
            });

            var results = search_journals.run().getRange(0, 10);
            if (results.length) {
                var internalid = results[0].getValue('internalid');
                record.delete({
                    type: 'journalentry',
                    id: internalid
                });
            }
        }

        //Obtiene las Notas de Debito de Interes y Multa
        function getOtherChargesTransactions(paymentObj) {
            var transactions = [];

            var appliedInvoices = [];

            var numApplieds = paymentObj.getLineCount({ sublistId: "apply" });
            for (var i = 0; i < numApplieds; i++) {
                var isApplied = paymentObj.getSublistValue({ sublistId: "apply", fieldId: "apply", line: i });
                var id = paymentObj.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
                if ((isApplied == "T" || isApplied == true) && appliedInvoices.indexOf(Number(id)) == -1) {
                    appliedInvoices.push(Number(id));
                }
            }

            var searchInvoices = search.create({
                type: "invoice",
                filters: [
                    ["internalid", "anyof", appliedInvoices], "AND",
                    ["mainline", "is", "T"], "AND",
                    ["memo", "startswith", MEMO_INTEREST]
                ],
                columns: ["internalid"]
            });

            var results = searchInvoices.run().getRange(0, 1000);

            for (var i = 0; i < results.length; i++) {
                var id = results[i].getValue("internalid");
                transactions.push(Number(id));
            }

            log.error("otherChargesTransactions", JSON.stringify(transactions));

            return transactions;
        }

        function deleteOtherChargesTransactions(paymentObj) {
            var invoices = getOtherChargesTransactions(paymentObj);
            for (var i = 0; i < invoices.length; i++) {
                var idInvoice = invoices[i];
                record.delete({
                    type: "invoice",
                    id: idInvoice
                });
            }
        }

        function removeOtherChargesInBRTransactionFields(paymentObj) {

            var searchLogs = search.create({
                type: "customrecord_lmry_br_custpayment_log",
                filters: [
                    ["isinactive", "is", "F"], "AND",
                    ["custrecord_lmry_br_custpaym_log_idpaymt", "anyof", paymentObj.id]
                ],
                columns: ["internalid", "custrecord_lmry_br_custpaym_log_data"]
            });

            var logs = searchLogs.run().getRange(0, 10);

            if (logs && logs.length) {
                var idLog = logs[0].getValue("internalid");
                log.error("idLog", idLog);
                var dataPayment = logs[0].getValue("custrecord_lmry_br_custpaym_log_data");

                if (dataPayment) {
                    dataPayment = JSON.parse(dataPayment);
                    var invoices = {}
                    for (var key in dataPayment) {
                        var interest = dataPayment[key]["interest"] || 0.00;
                        interest = parseFloat(interest);
                        var penalty = dataPayment[key]["penalty"] || 0.00;
                        penalty = parseFloat(penalty);

                        var idInvoice = key.split("-")[0];

                        if (!invoices[idInvoice]) {
                            invoices[idInvoice] = { "interest": 0.00, "penalty": 0.00 };
                        }

                        invoices[idInvoice]["interest"] = round2(invoices[idInvoice]["interest"] + interest);
                        invoices[idInvoice]["penalty"] = round2(invoices[idInvoice]["penalty"] + penalty);
                    }

                    log.error("invoices", JSON.stringify(invoices));


                    if (Object.keys(invoices).length) {
                        //Se buscan los BR Transaction fields de los invoices que componen este pago
                        var searchBRTransactionFields = search.create({
                            type: "customrecord_lmry_br_transaction_fields",
                            filters: [
                                ["isinactive", "is", "F"], "AND",
                                ["custrecord_lmry_br_related_transaction", "anyof", Object.keys(invoices)], "AND",
                                ["custrecord_lmry_br_related_transaction.mainline", "is", "T"]
                            ],
                            columns: ["internalid", "custrecord_lmry_br_related_transaction", "custrecord_lmry_br_interes", "custrecord_lmry_br_multa"]
                        });

                        var results = searchBRTransactionFields.run().getRange(0, 10);
                        if (results && results.length) {
                            for (var i = 0; i < results.length; i++) {
                                var idInvoice = results[i].getValue("custrecord_lmry_br_related_transaction");

                                if (invoices[String(idInvoice)]) {
                                    var interest = invoices[String(idInvoice)]["interest"];
                                    interest = parseFloat(interest) || 0.00;
                                    var penalty = invoices[String(idInvoice)]["penalty"];
                                    penalty = parseFloat(penalty) || 0.00;
                                    var idBrTransactionField = results[i].getValue("internalid");
                                    var currentInterest = results[i].getValue("custrecord_lmry_br_interes");
                                    currentInterest = parseFloat(currentInterest) || 0.00;
                                    var currentPenalty = results[i].getValue("custrecord_lmry_br_multa");
                                    currentPenalty = parseFloat(currentPenalty) || 0.00;

                                    if (interest || penalty) {
                                        currentInterest = currentInterest - interest;
                                        currentInterest = round2(currentInterest);
                                        currentPenalty = currentPenalty - penalty;
                                        currentPenalty = round2(currentPenalty);
                                        if (currentInterest >= 0 && currentPenalty >= 0) {
                                            record.submitFields({
                                                type: "customrecord_lmry_br_transaction_fields",
                                                id: idBrTransactionField,
                                                values: {
                                                    "custrecord_lmry_br_interes": currentInterest,
                                                    "custrecord_lmry_br_multa": currentPenalty
                                                },
                                                options: {
                                                    disableTriggers: true
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        function createPayment(paymentObj, transactions, form, process) {
            var idpayment = '';
            if (form) {
                var FEAT_INSTALLMENTS = runtime.isFeatureInEffect({ feature: "installments" });

                var customer = paymentObj['customer'];
                var paymentRecord = record.transform({
                    fromType: record.Type.CUSTOMER,
                    fromId: customer,
                    toType: record.Type.CUSTOMER_PAYMENT,
                    isDynamic: true,
                    defaultValues: {
                        'customform': form
                    }
                });

                paymentRecord.setValue('subsidiary', paymentObj['subsidiary']);
                paymentRecord.setValue('trandate', paymentObj['date']);
                paymentRecord.setValue('postingperiod', paymentObj['period']);
                paymentRecord.setValue('aracct', paymentObj['araccount']);
                paymentRecord.setValue('currency', paymentObj['currency']);
                paymentRecord.setValue('exchangerate', paymentObj['exchangerate']);
                paymentRecord.setValue('undepfunds', paymentObj['undepfunds']);

                if (paymentObj['undepfunds'] == 'F' && paymentObj['bankaccount']) {
                    paymentRecord.setValue('account', paymentObj['bankaccount']);
                }

                paymentRecord.setValue('custbody_lmry_paymentmethod', paymentObj['paymentmethod']);
                paymentRecord.setValue('memo', paymentObj['memo']);

                if (paymentObj['department']) {
                    paymentRecord.setValue('department', paymentObj['department']);
                }
                if (paymentObj['class']) {
                    paymentRecord.setValue('class', paymentObj['class']);
                }
                if (paymentObj['location']) {
                    paymentRecord.setValue('location', paymentObj['location']);
                }

                if (paymentObj["csegments"]) {
                    var csegments = paymentObj["csegments"];
                    for (var segmentId in csegments) {
                        if (paymentRecord.getField(segmentId)) {
                            var segmentValue = csegments[segmentId] || "";
                            paymentRecord.setValue(segmentId, segmentValue);
                        }
                    }
                }



                var numApply = paymentRecord.getLineCount({sublistId: 'apply'});

                for (var i = 0; i < numApply; i++) {
                    paymentRecord.selectLine({ sublistId: 'apply', line: i });

                    var lineId = paymentRecord.getCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'internalid'
                    });

                    var key = lineId;
                    if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == "T") {
                        var installnum = paymentRecord.getCurrentSublistValue({ sublistId: "apply", fieldId: "installmentnumber" });
                        if (installnum) {
                            key = lineId + "-" + installnum;
                        }
                    }

                    if (transactions[key]) {
                        paymentRecord.setCurrentSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            value: true
                        });

                        if(process == '0' && transactions[key]['primerpago'] == 'T'){
                          transactions[key]['amountpaid'] = parseFloat(transactions[key]['amountpaid']) + parseFloat(transactions[key]['advance']);
                        }

                        paymentRecord.setCurrentSublistValue({
                            sublistId: 'apply',
                            fieldId: 'amount',
                            value: parseFloat(transactions[key]['amountpaid'])
                        });
                    }

                }

                //APLICACION DEL ANTICIPO (CM O JOURNAL): SOLO PARA EL INDIVIDUAL
                var banderaJournal = true;
                var numCredit = paymentRecord.getLineCount({sublistId: 'credit'});

                if(process == 0 && paymentObj['advance']){
                  var auxAdvance = JSON.parse(paymentObj['advance']);
                  for(var i = 0; i < numCredit; i++){
                    paymentRecord.selectLine({ sublistId: 'credit', line: i });
                    var lineId = paymentRecord.getCurrentSublistValue({sublistId: 'credit',fieldId: 'internalid'});

                    var amountJournal = paymentRecord.getCurrentSublistValue({sublistId: 'credit', fieldId: 'total'});

                    for(var j in auxAdvance){
                      if(auxAdvance[j]['id'] == lineId && parseFloat(auxAdvance[j]['amount']) == Math.abs(parseFloat(amountJournal))){
                        paymentRecord.setCurrentSublistValue({sublistId: 'credit',fieldId: 'apply',value: true});
                        banderaJournal = false;
                      }
                    }

                    if(!banderaJournal){
                      break;
                    }


                  }
                }

                idpayment = paymentRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                });

            }
            return idpayment;
        }

        function getPaymentAccountingBooks(idPayment) {

            var paymentResult = search.lookupFields({
                type: "customerpayment",
                id: idPayment,
                columns: ["internalid", "exchangerate", "subsidiary"]
            });

            var exchangeRate = paymentResult["exchangerate"];
            var books = [0], exchangeRates = [exchangeRate];

            var featureMB = runtime.isFeatureInEffect({
                feature: "MULTIBOOK"
            });

            if (featureMB == "T" || featureMB == true) {
                var subsidiary = paymentResult["subsidiary"];
                if (subsidiary && subsidiary.length) {
                    subsidiary = subsidiary[0]['value'];
                }

                var searchSecondaryBooks = search.create({
                    type: "accountingbook",
                    filters:
                        [
                            ["isprimary", "is", "F"], "AND",
                            ["subsidiary", "anyof", subsidiary], "AND",
                            ["status", "anyof", "ACTIVE"]
                        ],
                    columns: ["internalid"]
                });

                var results = searchSecondaryBooks.run().getRange(0, 10);
                var secondaryBooks = [];
                for (var i = 0; i < results.length; i++) {
                    var bookId = results[i].getValue("internalid");
                    secondaryBooks.push(bookId);
                }

                if (secondaryBooks.length) {
                    var searchAccountingBooks = search.create({
                        type: "transaction",
                        filters:
                            [
                                ["internalidnumber", "equalto", idPayment], "AND",
                                ["mainline", "is", "T"], "AND",
                                ["accountingtransaction.accountingbook", "anyof", secondaryBooks]
                            ],
                        columns: [
                            search.createColumn({
                                name: "accountingbook",
                                join: "accountingTransaction",
                                sort: search.Sort.ASC
                            }),
                            search.createColumn({
                                name: "exchangerate",
                                join: "accountingTransaction"
                            })
                        ],
                        settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
                    });

                    var results = searchAccountingBooks.run().getRange(0, 10);
                    var columns = searchAccountingBooks.columns;
                    for (var i = 0; i < results.length; i++) {
                        var bookId = results[i].getValue(columns[0]);
                        var bookExchangeRate = results[i].getValue(columns[1]);
                        bookExchangeRate = parseFloat(bookExchangeRate);
                        if (books.indexOf(Number(bookId)) == -1) {
                            books.push(Number(bookId));
                            exchangeRates.push(bookExchangeRate);
                        }
                    }
                }
            }

            return books.join("|") + "&" + exchangeRates.join("|");
        }

        function getPaymentTaxResults(idpayment, subtypes) {
            var taxResults = [];
            var search_taxresults = search.create({
                type: 'customrecord_lmry_br_transaction',
                filters: [
                    ['isinactive', 'is', 'F'], 'AND',
                    ['custrecord_lmry_br_transaction', 'anyof', idpayment], 'AND',
                    ['custrecord_lmry_tax_type', 'anyof', "1"], 'AND',
                    ['custrecord_lmry_br_type_id', 'anyof', subtypes]
                ],
                columns: [
                    'internalid', 'custrecord_lmry_br_type_id', 'custrecord_lmry_br_total', 'custrecord_lmry_item', 'custrecord_lmry_related_applied_transact',
                    'custrecord_lmry_ccl.custrecord_lmry_ar_ccl_taxitem', 'custrecord_lmry_ntax.custrecord_lmry_ntax_taxitem', "custrecord_lmry_related_installm_num"
                ]
            });


            var results = search_taxresults.run().getRange(0, 1000);
            if (results) {
                for (var i = 0; i < results.length; i++) {
                    var taxresultObj = {
                        'internalid': results[i].getValue('internalid'),
                        'subtype': results[i].getText('custrecord_lmry_br_type_id'),
                        'subtypeid': results[i].getValue('custrecord_lmry_br_type_id'),
                        'fxamount': results[i].getValue('custrecord_lmry_br_total') || 0.00,
                        'idtransaction': idpayment,
                        'idapplytransaction': results[i].getValue('custrecord_lmry_related_applied_transact') || '',
                        'iditem': results[i].getValue('custrecord_lmry_item') || "",
                        'taxItem': results[i].getValue({ name: "custrecord_lmry_ar_ccl_taxitem", join: "custrecord_lmry_ccl" }) || results[i].getValue({ name: "custrecord_lmry_ntax_taxitem", join: "custrecord_lmry_ntax" }),
                        "installmentnumber": results[i].getValue("custrecord_lmry_related_installm_num")
                    };

                    taxResults.push(taxresultObj);
                }
            }

            return taxResults;
        }

        function getSetupTaxSubsidiary(idSubsidiary) {
            var setupTaxSubsidiary = {};
            if (idSubsidiary) {
                var search_setup = search.create({
                    type: 'customrecord_lmry_setup_tax_subsidiary',
                    filters: [
                        ['custrecord_lmry_setuptax_subsidiary', 'anyof', idSubsidiary], 'AND',
                        ['isinactive', 'is', 'F']
                    ],
                    columns: [
                        'internalid', 'custrecord_lmry_setuptax_form_custpaymt', 'custrecord_lmry_setuptax_form_journal',
                        'custrecord_lmry_setuptax_reclass_subtyps', "custrecord_lmry_setuptax_form_invoice", "custrecord_lmry_setuptax_br_document",
                        "custrecord_lmry_setuptax_br_tax_code", "custrecord_lmry_br_ar_interes_item", "custrecord_lmry_br_ar_multa_item"
                    ]
                });

                var results = search_setup.run().getRange(0, 10);
                if (results && results.length) {
                    setupTaxSubsidiary['paymentform'] = results[0].getValue('custrecord_lmry_setuptax_form_custpaymt') || '';
                    setupTaxSubsidiary['journalform'] = results[0].getValue('custrecord_lmry_setuptax_form_journal') || '';
                    setupTaxSubsidiary["invoiceform"] = results[0].getValue("custrecord_lmry_setuptax_form_invoice") || "";
                    setupTaxSubsidiary["document"] = results[0].getValue("custrecord_lmry_setuptax_br_document") || "";
                    setupTaxSubsidiary["taxcode"] = results[0].getValue("custrecord_lmry_setuptax_br_tax_code") || "";
                    setupTaxSubsidiary["interestItem"] = results[0].getValue("custrecord_lmry_br_ar_interes_item") || "";
                    setupTaxSubsidiary["penaltyItem"] = results[0].getValue("custrecord_lmry_br_ar_multa_item") || "";

                    var subtypes = results[0].getValue('custrecord_lmry_setuptax_reclass_subtyps');
                    if (subtypes) {
                        setupTaxSubsidiary['reclassSubtypes'] = subtypes.split(',');
                    }
                }
            }

            return setupTaxSubsidiary;
        }

        function crearNotaDebitoInteresMulta(idInvoice, installmentNumber, idPayment, interest, penalty, setup) {

            ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

            var idTransaction = "";

            interest = parseFloat(interest) || 0.00;
            penalty = parseFloat(penalty) || 0.00;
            if (interest + penalty) {

                var F_DEPARTMENTS = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
                var F_LOCATIONS = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
                var F_CLASSES = runtime.isFeatureInEffect({ feature: "CLASSES" });
                var F_APPROVAL_INVOICE = runtime.getCurrentScript().getParameter({ name: "CUSTOMAPPROVALCUSTINVC" });
                var F_MULTPRICE = runtime.isFeatureInEffect({ feature: 'MULTPRICE' });

                var columns = ["trandate", "postingperiod", "entity", "subsidiary", "currency", "exchangerate"];

                if (F_DEPARTMENTS == true || F_DEPARTMENTS == 'T') {
                    columns.push("department");
                }

                if (F_CLASSES == true || F_CLASSES == 'T') {
                    columns.push("class");
                }

                if (F_LOCATIONS == true || F_LOCATIONS == 'T') {
                    columns.push("location");
                }

                var customSegments = getCustomSegments();

                for (var i = 0; i < customSegments.length; i++) {
                    var customSegmentId = customSegments[i];
                    columns.push(customSegmentId);
                }

                var paymentResult = search.lookupFields({
                    type: "customerpayment",
                    id: idPayment,
                    columns: columns
                });

                log.error("paymentResult", JSON.stringify(paymentResult));

                var segmentation = {};
                var department = paymentResult['department'] || '';
                if (department && department.length) {
                    segmentation['department'] = department[0]['value'];
                }

                var class_ = paymentResult['class'] || '';

                if (class_ && class_.length) {
                    segmentation['class'] = class_[0]['value'];
                }

                var location = paymentResult['location'] || '';

                if (location && location.length) {
                    segmentation['location'] = location[0]['value'];
                }

                for (var i = 0; i < customSegments.length; i++) {
                    var segmentId = customSegments[i];
                    var segmentValue = paymentResult[segmentId] || "";
                    if (segmentValue && segmentValue.length) {
                        segmentation[segmentId] = segmentValue[0]["value"]
                    }
                }

                var subsidiary = paymentResult["subsidiary"][0]["value"];
                var customer = paymentResult["entity"][0]["value"];
                var currency = paymentResult["currency"][0]["value"];
                var postingperiod = paymentResult["postingperiod"][0]["value"];
                var exchangerate = paymentResult["exchangerate"];
                var trandate = paymentResult["trandate"];
                trandate = format.parse({ value: trandate, type: format.Type.DATE });

                var form = setup["invoiceform"];
                var document = setup["document"];
                var taxcode = setup["taxcode"];
                var interestItem = setup["interestItem"];
                var penaltyItem = setup["penaltyItem"];

                if (form && (interestItem || penaltyItem)) {

                    if(ST_FEATURE === true || ST_FEATURE === "T") {

                        var invoice_record = record.load({
                            type: 'invoice',
                            id: idInvoice
                        });

                        var entityTaxRegNum = invoice_record.getValue('entitytaxregnum');
                        var nexus = invoice_record.getValue('nexus');
                        var subsidiaryTaxRegNum = invoice_record.getValue('subsidiarytaxregnum');

                    }

                    var invoiceObj = record.transform({
                        fromType: "customer",
                        fromId: customer,
                        toType: "invoice",
                        isDynamic: false,
                        defaultValues: {
                            "customform": form
                        }
                    });

                    invoiceObj.setValue("subsidiary", subsidiary)
                    invoiceObj.setValue("trandate", trandate);
                    invoiceObj.setValue("postingperiod", postingperiod);
                    invoiceObj.setValue("currency", currency);
                    invoiceObj.setValue("exchangerate", exchangerate);

                    if(ST_FEATURE === true || ST_FEATURE === "T") {
                        invoiceObj.setValue("taxregoverride", true);
                        invoiceObj.setValue("taxdetailsoverride", true);
                        invoiceObj.setValue("entitytaxregnum", entityTaxRegNum);
                        invoiceObj.setValue("nexus", nexus);
                        invoiceObj.setValue("subsidiarytaxregnum", subsidiaryTaxRegNum);
                    }

                    var memo = MEMO_INTEREST + " -" + idInvoice;
                    if (installmentNumber) {
                        memo = memo + "-" + installmentNumber
                    }

                    invoiceObj.setValue('memo', memo);
                    invoiceObj.setValue('custbody_lmry_reference_transaction', idInvoice);
                    invoiceObj.setValue('custbody_lmry_reference_transaction_id', idInvoice);
                    invoiceObj.setValue('custbody_lmry_document_type', document); //LATAM - LEGAL DOCUMENT TYPE
                    invoiceObj.setValue("terms", "");

                    if (F_APPROVAL_INVOICE && invoiceObj.getField({
                        fieldId: 'approvalstatus'
                    })) {
                        invoiceObj.setValue('approvalstatus', 2);
                    }

                    removeAllItems(invoiceObj);

                    var items = [
                        { item: interestItem, memo: "Interest - ID: " + idInvoice, amount: interest },
                        { item: penaltyItem, memo: "Penalty - ID: " + idInvoice, amount: penalty }
                    ];

                    var j = 0;
                    for (var i = 0; i < items.length; i++) {
                        if (items[i]["item"] && items[i]["amount"]) {
                            invoiceObj.insertLine({
                                sublistId: 'item',
                                line: j
                            });
                            invoiceObj.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: j,
                                value: items[i]["item"]
                            });

                            if (F_MULTPRICE == true || F_MULTPRICE == "T") {
                                invoiceObj.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'price',
                                    line: j,
                                    value: -1
                                });
                            }

                            var amount = items[i]["amount"];
                            amount = round2(amount);

                            invoiceObj.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'rate',
                                line: j,
                                value: amount
                            });
                            invoiceObj.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'amount',
                                line: j,
                                value: amount
                            });

                            if(ST_FEATURE === false || ST_FEATURE === "F") {

                                invoiceObj.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'tax1amt',
                                    line: j,
                                    value: 0.00
                                });

                                if (taxcode) {
                                    invoiceObj.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'taxcode',
                                        line: j,
                                        value: taxcode
                                    });
                                }

                            }

                            invoiceObj.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'description',
                                line: j,
                                value: items[i]["memo"]
                            });

                            for (var segmentId in segmentation) {
                                var segmentField = invoiceObj.getSublistField({ sublistId: "item", fieldId: segmentId, line: j });
                                if (segmentField && segmentation[segmentId]) {
                                    invoiceObj.setSublistValue({ sublistId: "item", fieldId: segmentId, line: j, value: segmentation[segmentId] });
                                }
                            }

                            j++;
                        }
                    }

                    idTransaction = invoiceObj.save({
                        ignoreMandatoryFields: true,
                        disableTriggers: true,
                        enableSourcing: true
                    });
                }
            }

            return idTransaction
        }

        function removeAllItems(recordObj) {
            while (true) {
                var numberItems = recordObj.getLineCount({ sublistId: 'item' });
                if (numberItems) {
                    recordObj.removeLine({ sublistId: 'item', line: numberItems - 1 });
                } else {
                    break;
                }
            }
        }

        function applyInvoicesinPayment(idpayment, invoices) {
            //if (Object.keys(invoices).length) {

                var additionalAmount = 0.00;

                //Se acumula el monto total que se agregara al monto total del pago.
                if(Object.keys(invoices).length){
                  for (var i in invoices) {
                      var amount = invoices[i]["amount"] || 0.00;
                      additionalAmount += amount;
                  }
                }


                var paymentObj = record.load({
                    type: "customerpayment",
                    id: idpayment,
                    isDynamic: true
                });


                //Se aumenta al monto total del pago, el monto de las notas de debito de interes y multas.
                var currentPaymentAmount = paymentObj.getValue("payment");
                currentPaymentAmount = parseFloat(currentPaymentAmount);
                paymentObj.setValue("payment", round2(currentPaymentAmount + additionalAmount));


                //Se aplican las notas de debitos al pago.
                var numApply = paymentObj.getLineCount({
                    sublistId: 'apply'
                });

                for (var i = 0; i < numApply; i++) {
                    paymentObj.selectLine({ sublistId: 'apply', line: i });

                    var lineId = paymentObj.getCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'internalid',
                        line: i
                    });

                    if(Object.keys(invoices).length){
                      if (invoices[String(lineId)]) {

                          paymentObj.setCurrentSublistValue({
                              sublistId: 'apply',
                              fieldId: 'apply',
                              value: true
                          });

                          paymentObj.setCurrentSublistValue({
                              sublistId: "apply",
                              fieldId: "amount",
                              value: parseFloat(invoices[String(lineId)]["amount"])
                          });
                      }
                    }

                }

                paymentObj.setValue('custbody_lmry_br_amount_advance','1');

                paymentObj.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                });

            //}
        }

        function updateBRTransactionFields(invoices) {
            var brTransactionFields = [];
            if (Object.keys(invoices).length) {
                var hasBrTransactionFields = [];

                var searchBRTransactionFields = search.create({
                    type: "customrecord_lmry_br_transaction_fields",
                    filters: [
                        ["isinactive", "is", "F"], "AND",
                        ["custrecord_lmry_br_related_transaction", "anyof", Object.keys(invoices)]
                    ],
                    columns: ["internalid", "custrecord_lmry_br_related_transaction", "custrecord_lmry_br_interes", "custrecord_lmry_br_multa"]
                });

                var results = searchBRTransactionFields.run().getRange(0, 1000);
                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var id = results[i].getValue("internalid");
                        var idInvoice = results[i].getValue("custrecord_lmry_br_related_transaction");
                        var currentInterest = results[i].getValue("custrecord_lmry_br_interes") || 0.00;
                        var currentPenalty = results[i].getValue("custrecord_lmry_br_multa") || 0.00;

                        if (invoices[String(idInvoice)]) {

                            brTransactionFields.push(id);
                            hasBrTransactionFields.push(Number(idInvoice));

                            var interest = parseFloat(invoices[String(idInvoice)]["interest"]) || 0.00;
                            var penalty = parseFloat(invoices[String(idInvoice)]["penalty"]) || 0.00;

                            if (interest || penalty) {
                                //Se acumulan los montos de interes y multa

                                interest += parseFloat(currentInterest);
                                penalty += parseFloat(currentPenalty);

                                record.submitFields({
                                    type: "customrecord_lmry_br_transaction_fields",
                                    id: id,
                                    values: {
                                        "custrecord_lmry_br_interes": round2(interest),
                                        "custrecord_lmry_br_multa": round2(penalty)
                                    },
                                    options: {
                                        disableTriggers: true
                                    }
                                });
                            }
                        }
                    }

                }


                for (var idInvoice in invoices) {
                    if (hasBrTransactionFields.indexOf(Number(idInvoice)) == -1) {
                        var brTransactionField = record.create({
                            type: "customrecord_lmry_br_transaction_fields"
                        });

                        var interest = invoices[String(idInvoice)]["interest"];
                        var penalty = invoices[String(idInvoice)]["penalty"];

                        brTransactionField.setValue({ fieldId: "custrecord_lmry_br_related_transaction", value: idInvoice });
                        brTransactionField.setValue({ fieldId: "custrecord_lmry_br_interes", value: parseFloat(interest) || 0.00 });
                        brTransactionField.setValue({ fieldId: "custrecord_lmry_br_multa", value: parseFloat(penalty) || 0.00 });
                        var idBrTransactionField = brTransactionField.save({
                            ignoreMandatoryFields: true,
                            enableSourcing: true,
                            disableTriggers: true
                        });

                        brTransactionFields.push(idBrTransactionField);
                    }
                }
            }

            return brTransactionFields;
        }

        function getCustomSegments() {
            var customSegments = [];
            var FEAT_CUSTOMSEGMENTS = runtime.isFeatureInEffect({ feature: "customsegments" });

            if (FEAT_CUSTOMSEGMENTS == true || FEAT_CUSTOMSEGMENTS == "T") {
                var searchCustomSegments = search.create({
                    type: "customrecord_lmry_setup_cust_segm",
                    filters: [
                        ["isinactive", "is", "F"]
                    ],
                    columns: [
                        "internalid", "name", "custrecord_lmry_setup_cust_segm"]
                });

                var results = searchCustomSegments.run().getRange(0, 1000);

                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var customSegmentId = results[i].getValue("custrecord_lmry_setup_cust_segm");
                        customSegmentId = customSegmentId.trim() || "";
                        if (customSegmentId) {
                            customSegments.push(customSegmentId);
                        }
                    }
                }
            }
            return customSegments;
        }

        function getWhtTaxResults(idtransaction, subtypes) {
            var taxresults = [];
            var search_taxresults = search.create({
                type: 'customrecord_lmry_br_transaction',
                filters: [
                    ['isinactive', 'is', 'F'], 'AND',
                    ['custrecord_lmry_br_transaction', 'anyof', idtransaction], 'AND',
                    ['custrecord_lmry_tax_type', 'anyof', "1"], 'AND',
                    ['custrecord_lmry_br_type_id', 'anyof', subtypes]
                ],
                columns: [
                    'internalid', 'custrecord_lmry_br_type_id', 'custrecord_lmry_base_amount', 'custrecord_lmry_br_total',
                    'custrecord_lmry_total_base_currency', 'custrecord_lmry_base_amount_local_currc', 'custrecord_lmry_amount_local_currency',
                    'custrecord_lmry_br_percent', 'custrecord_lmry_ccl', 'custrecord_lmry_ntax', 'custrecord_lmry_item',
                    search.createColumn({
                        name: "custrecord_lmry_ar_ccl_taxitem",
                        join: "CUSTRECORD_LMRY_CCL"
                    }),
                    search.createColumn({
                        name: "custrecord_lmry_ntax_taxitem",
                        join: "CUSTRECORD_LMRY_NTAX"
                    })
                ]
            });

            var columns = search_taxresults.columns;

            var results = search_taxresults.run().getRange(0, 1000);

            if (results) {
                for (var i = 0; i < results.length; i++) {
                    var typeRecord = 'ccl';
                    var idrecordtax = results[i].getValue('custrecord_lmry_ccl') || '';
                    var taxitem = results[i].getValue(columns[11])

                    if (!idrecordtax) {
                        typeRecord = 'ntax';
                        idrecordtax = results[i].getValue('custrecord_lmry_ntax');
                        results[i].getValue(columns[12]);
                    }

                    var taxresultObj = {
                        'internalid': results[i].getValue('internalid'),
                        'subtype': results[i].getText('custrecord_lmry_br_type_id'),
                        'subtypeid': results[i].getValue('custrecord_lmry_br_type_id'),
                        'baseAmount': results[i].getValue('custrecord_lmry_base_amount'),
                        'fxamount': results[i].getValue('custrecord_lmry_br_total'),
                        'amount': results[i].getValue('custrecord_lmry_amount_local_currency'),
                        'taxRate': results[i].getValue('custrecord_lmry_br_percent'),
                        'typeRecord': typeRecord,
                        'idRecord': idrecordtax,
                        'locCurrBaseAmount': results[i].getValue('custrecord_lmry_base_amount_local_currc'),
                        'iditem': results[i].getValue('custrecord_lmry_item') || "",
                        'taxitem': taxitem
                    };

                    taxresults.push(taxresultObj);
                }
            }

            return taxresults;
        }

        function createPaymentWhtTaxResults(idInvoice, installmentNumber, idPayment, amountPaid, reclassSubtypes) {
            var paymentTaxResults = [];

            var invoiceWhtTaxResults = getWhtTaxResults(idInvoice, reclassSubtypes);
            log.error("invoiceWhtTaxResults", JSON.stringify(invoiceWhtTaxResults));

            if (invoiceWhtTaxResults.length) {
                var accountingbooks = getPaymentAccountingBooks(idPayment);
                var invoiceObj = getInvoiceAmounts(idInvoice);
                log.error("invoiceObj", JSON.stringify(invoiceObj));

                var totalInvoice = invoiceObj["total"];
                var whtTotal = invoiceObj["whtAmount"];
                var partialAmount = invoiceObj["total"];
                var partialWhtAmount = invoiceObj["whtAmount"];

                var iFactorAmount = 1, iFactorBase = 1;

                if (installmentNumber && invoiceObj[String(installmentNumber)]) {
                    partialAmount = invoiceObj[String(installmentNumber)]["total"];
                    partialWhtAmount = invoiceObj[String(installmentNumber)]["whtAmount"];

                    var installmentAmount = invoiceObj[String(installmentNumber)]["total"];
                    var installmentWHT = invoiceObj[String(installmentNumber)]["whtAmount"];
                    iFactorBase = installmentAmount / totalInvoice;
                    iFactorAmount = installmentWHT / whtTotal;
                    log.error("[iFactorBase,iFactorAmount]", [iFactorBase, iFactorAmount].join("-"));
                }

                var amountRemaining = round2(parseFloat(partialAmount) - parseFloat(partialWhtAmount));

                log.error('[partialAmount, amountdue]', [partialAmount, amountRemaining].join('-'));

                // Se obtiene el factor de prorrateo para pagos parciales
                var factor = 1;

                if (parseFloat(amountPaid) != parseFloat(amountRemaining)) {
                    factor = parseFloat(amountPaid) / parseFloat(amountRemaining);
                }

                log.error('factor', factor);

                for (var i = 0; i < invoiceWhtTaxResults.length; i++) {

                    var taxresultObj = {
                        'sourceid': invoiceWhtTaxResults[i]['internalid'],
                        'subtype': invoiceWhtTaxResults[i]['subtype'],
                        'subtypeid': invoiceWhtTaxResults[i]['subtypeid'],
                        'baseAmount': invoiceWhtTaxResults[i]['baseAmount'] * iFactorBase * factor,
                        'fxamount': invoiceWhtTaxResults[i]['fxamount'] * iFactorAmount * factor,
                        'amount': invoiceWhtTaxResults[i]['amount'] * iFactorAmount * factor,
                        'locCurrBaseAmount': invoiceWhtTaxResults[i]['locCurrBaseAmount'] * iFactorBase * factor,
                        'idtransaction': idPayment,
                        'idapplytransaction': idInvoice,
                        'accountingbooks': accountingbooks,
                        "installmentnumber": installmentNumber
                    };

                    paymentTaxResults.push(taxresultObj);
                    savePaymentTaxResult(taxresultObj);
                }
            }

            return paymentTaxResults;
        }

        function getReclassAccounts(subsidiary, subtypes) {
            var reclassaccounts = {}
            var filters = [
                ['isinactive', 'is', 'F'], 'AND',
                ['custrecord_lmry_br_wht_reclass_subsi', 'anyof', subsidiary], 'AND',
                ['custrecord_lmry_br_wht_reclass_subtype', 'anyof', subtypes]
            ];

            var search_reclass = search.create({
                type: 'customrecord_lmry_br_wht_reclass_account',
                filters: filters,
                columns: [
                    'internalid',
                    'custrecord_lmry_br_wht_reclass_subtype',
                    'custrecord_lmry_br_wht_reclass_accdeb'
                ]
            });

            var results = search_reclass.run().getRange(0, 1000);

            if (results) {
                for (var i = 0; i < results.length; i++) {
                    var internalid = results[i].getValue('internalid');
                    var subtype = results[i].getValue('custrecord_lmry_br_wht_reclass_subtype');
                    var account = results[i].getValue('custrecord_lmry_br_wht_reclass_accdeb') || '';
                    reclassaccounts[String(subtype)] = { 'internalid': internalid, 'account': account }
                }
            }

            return reclassaccounts;
        }

        function getSubtypeAccounts(taxResults) {
            var subtypeAccounts = {};

            var invoices = [], itemBySubtype = {};

            for (var i = 0; i < taxResults.length; i++) {
                var idInvoice = taxResults[i]["idapplytransaction"];
                var taxItem = taxResults[i]["taxItem"];
                var subtype = taxResults[i]["subtypeid"];

                if (idInvoice && invoices.indexOf(Number(idInvoice)) == -1) {
                    invoices.push(Number(idInvoice));
                }

                if (taxItem && !itemBySubtype[String(subtype)]) {
                    itemBySubtype[String(subtype)] = taxItem;
                }
            }

            var searchCreditMemos = search.create({
                type: "creditmemo",
                filters: [
                    ["appliedtotransaction", "anyof", invoices], "AND",
                    ["mainline", "is", "T"], "AND",
                    ["memo", "startswith", MEMO_WHT]
                ],
                columns: ["internalid"]
            });

            var results = searchCreditMemos.run().getRange(0, 1000);

            var idCreditMemos = [];
            for (var i = 0; i < results.length; i++) {
                var idCreditMemo = results[i].getValue("internalid");
                if (idCreditMemos.indexOf(Number(idCreditMemo)) == -1) {
                    idCreditMemos.push(Number(idCreditMemo));
                }
            }

            if (idCreditMemos.length) {
                var searchAccounts = search.create({
                    type: "creditmemo",
                    filters: [
                        ["internalid", "anyof", idCreditMemos], "AND",
                        ["mainline", "is", "F"], "AND",
                        ["cogs", "is", "F"], "AND",
                        ["taxline", "is", "F"], "AND",
                        ["formulatext: {item.type.id}", "isnot", "ShipItem"], "AND",
                        ["item", "noneof", "@NONE@"]
                    ],
                    columns: [
                        search.createColumn({
                            name: "item",
                            summary: "GROUP"
                        }),
                        search.createColumn({
                            name: "account",
                            summary: "GROUP"
                        })
                    ]
                });

                var results = searchAccounts.run().getRange(0, 1000);
                var columns = searchAccounts.columns;
                for (var i = 0; i < results.length; i++) {
                    var taxItem = results[i].getValue(columns[0]);
                    var account = results[i].getValue(columns[1]);

                    if (Number(account)) {
                        for (var subType in itemBySubtype) {
                            if (Number(taxItem) == Number(itemBySubtype[subType])) {
                                subtypeAccounts[String(subType)] = account;
                            }
                        }
                    }
                }
            }

            return subtypeAccounts;
        }
        function savePaymentTaxResult(taxresultObj) {
            var recordTaxResult = record.copy({
                type: 'customrecord_lmry_br_transaction',
                id: taxresultObj['sourceid'],
                isDynamic: false
            });

            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_br_related_id',
                value: String(taxresultObj['idtransaction'])
            });

            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_br_transaction',
                value: String(taxresultObj['idtransaction'])
            });


            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_base_amount',
                value: round4(taxresultObj['baseAmount'])
            });

            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_br_total',
                value: round4(taxresultObj['fxamount'])
            });


            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_total_base_currency',
                value: round4(taxresultObj['amount'])
            });

            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_base_amount_local_currc',
                value: taxresultObj['locCurrBaseAmount']
            });

            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_amount_local_currency',
                value: taxresultObj['amount']
            });

            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_related_applied_transact',
                value: taxresultObj['idapplytransaction']
            });


            recordTaxResult.setValue({
                fieldId: 'custrecord_lmry_accounting_books',
                value: taxresultObj['accountingbooks']
            });

            if (taxresultObj["installmentnumber"]) {
                recordTaxResult.setValue({
                    fieldId: "custrecord_lmry_related_installm_num",
                    value: taxresultObj["installmentnumber"]
                });
            }

            var idtaxresult = recordTaxResult.save({
                ignoreMandatoryFields: true,
                disableTriggers: true,
                enableSourcing: true
            });

            log.error('idtaxresult', idtaxresult);
        }

        function createReclassJournalEntry(idPayment, reclassSubtypes, form) {
            var idjournal = '';
            if (form) {
                var paymentTaxResults = getPaymentTaxResults(idPayment, reclassSubtypes);
                log.error('paymentTaxResults', JSON.stringify(paymentTaxResults));

                if (paymentTaxResults.length) {

                    var FEAT_DPT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
                    var FEAT_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
                    var FEAT_LOC = runtime.isFeatureInEffect({ feature: "LOCATIONS" });

                    var columns = ['entity', 'currency', 'subsidiary', 'postingperiod', 'exchangerate', 'trandate'];

                    if (FEAT_DPT == 'T' || FEAT_DPT == true) {
                        columns.push('department');
                    }

                    if (FEAT_CLASS == 'T' || FEAT_CLASS == true) {
                        columns.push('class');
                    }

                    if (FEAT_LOC == 'T' || FEAT_LOC == true) {
                        columns.push('location');
                    }

                    var paymentResult = search.lookupFields({
                        type: 'customerpayment',
                        id: idPayment,
                        columns: columns
                    });

                    var subsidiary = paymentResult["subsidiary"][0]["value"];
                    var customer = paymentResult["entity"][0]["value"];
                    var currency = paymentResult["currency"][0]["value"];
                    var postingperiod = paymentResult["postingperiod"][0]["value"];
                    var exchangerate = paymentResult["exchangerate"];
                    var trandate = paymentResult["trandate"];
                    trandate = format.parse({ value: trandate, type: format.Type.DATE });

                    var department = "";
                    if (paymentResult["department"] && paymentResult["department"].length) {
                        department = paymentResult["department"][0]["value"];
                    }

                    var class_ = "";
                    if (paymentResult["class"] && paymentResult["class"].length) {
                        class_ = paymentResult["class"][0]["value"];
                    }

                    var location = "";
                    if (paymentResult["location"] && paymentResult["location"].length) {
                        location = paymentResult["location"][0]["value"];
                    }

                    //Se obtienen las cuentas de reclasificacion por subtype
                    var reclassAccounts = getReclassAccounts(subsidiary, reclassSubtypes);
                    log.error('reclassAccounts', JSON.stringify(reclassAccounts));

                    //Se obtienen las cuentas actuales de retencion por subtype.
                    var subtypeAccounts = getSubtypeAccounts(paymentTaxResults);
                    log.error('subtypeAccounts', JSON.stringify(subtypeAccounts));

                    if (Object.keys(reclassAccounts).length && Object.keys(subtypeAccounts).length) {
                        var journalRecord = record.create({
                            type: 'journalentry',
                            isDynamic: true
                        });

                        journalRecord.setValue("customform", form);
                        journalRecord.setValue('subsidiary', subsidiary);
                        journalRecord.setValue('currency', currency);
                        journalRecord.setValue('exchangerate', exchangerate);
                        journalRecord.setValue('trandate', trandate);
                        journalRecord.setValue("postingperiod", postingperiod);
                        journalRecord.setValue('custbody_lmry_reference_transaction', idPayment);
                        journalRecord.setValue("custbody_lmry_reference_transaction_id", idPayment);
                        journalRecord.setValue('memo', MEMO_RECLASS);

                        if ((FEAT_DPT == "T" || FEAT_DPT == true) && department) {
                            journalRecord.setValue('department', department);
                        }

                        if ((FEAT_CLASS == "T" || FEAT_CLASS == true) && class_) {
                            journalRecord.setValue('class', class_);
                        }

                        if ((FEAT_LOC == "T" || FEAT_LOC == true) && location) {
                            journalRecord.setValue('location', location);
                        }


                        var approvalFeature = runtime.getCurrentScript().getParameter({ name: 'CUSTOMAPPROVALJOURNAL' });

                        if (approvalFeature && journalRecord.getField({ fieldId: 'approvalstatus' })) {
                            journalRecord.setValue('approvalstatus', 2);
                        }

                        for (var i = 0; i < paymentTaxResults.length; i++) {
                            var taxresult = paymentTaxResults[i];

                            var subtype = taxresult['subtypeid'];
                            var idinvoice = taxresult['idapplytransaction'];

                            if (subtypeAccounts[String(subtype)] && reclassAccounts[String(subtype)]) {
                                var accountcredit = subtypeAccounts[String(subtype)];
                                var accountdebit = reclassAccounts[String(subtype)]['account'];

                                if (accountcredit && accountdebit) {
                                    var amount = taxresult['fxamount'];

                                    amount = round2(amount);

                                    if (amount) {

                                        var memo = taxresult['subtype'] + ' (Reclassification - WHT) -' + idinvoice;

                                        if (taxresult["installmentnumber"]) {
                                            memo = memo + "-" + taxresult["installmentnumber"];
                                        }

                                        //Credit
                                        journalRecord.selectNewLine({ sublistId: 'line' });
                                        journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: accountcredit });
                                        journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: amount });
                                        journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_lmry_pe_transaction_reference', value: idinvoice });
                                        journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'memo', value: memo });

                                        if ((FEAT_DPT == "T" || FEAT_DPT == true) && department) {
                                            journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'department', value: department });
                                        }

                                        if ((FEAT_CLASS == "T" || FEAT_CLASS == true) && class_) {
                                            journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'class', value: class_ });
                                        }

                                        if ((FEAT_LOC == "T" || FEAT_LOC == true) && location) {
                                            journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'location', value: location });
                                        }

                                        journalRecord.commitLine({ sublistId: 'line' });


                                        //Debit
                                        journalRecord.selectNewLine({ sublistId: 'line' });
                                        journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: accountdebit });
                                        journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: amount });
                                        journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_lmry_pe_transaction_reference', value: idinvoice });
                                        journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'memo', value: memo });

                                        if ((FEAT_DPT == "T" || FEAT_DPT == true) && department) {
                                            journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'department', value: department });
                                        }

                                        if ((FEAT_CLASS == "T" || FEAT_CLASS == true) && class_) {
                                            journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'class', value: class_ });
                                        }

                                        if ((FEAT_LOC == "T" || FEAT_LOC == true) && location) {
                                            journalRecord.setCurrentSublistValue({ sublistId: 'line', fieldId: 'location', value: location });
                                        }

                                        journalRecord.commitLine({ sublistId: 'line' });
                                    }
                                }
                            }

                        }

                        if (journalRecord.getLineCount({ sublistId: "line" })) {
                            idjournal = journalRecord.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true,
                                disableTriggers: true
                            });
                        }
                    }
                }
            }

            return idjournal;
        }

        function getInvoiceAmounts(idInvoice) {
            var invoiceObj = {};

            var columns = [
                "internalid",
                "fxamount",
                "applyingtransaction",
                "applyingTransaction.fxamount"
            ];

            var FEAT_INSTALLMENTS = runtime.isFeatureInEffect({ feature: "installments" });
            if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == "T") {
                columns.push("installment.installmentnumber", "installment.fxamount");
            }

            var searchWHT = search.create({
                type: "invoice",
                filters:
                    [
                        ["internalid", "anyof", idInvoice], "AND",
                        ["applyingtransaction.type", "anyof", "CustCred"], "AND",
                        ["applyingtransaction.memomain", "startswith", MEMO_WHT], "AND",
                        ["applyingtransaction.mainline", "is", "T"]
                    ],
                columns: columns,
                settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
            });

            var results = searchWHT.run().getRange(0, 10);
            if (results && results.length) {
                var total = results[0].getValue("fxamount") || 0.00;
                var whtAmount = results[0].getValue({ name: "fxamount", join: "applyingtransaction" }) || 0.00;
                invoiceObj["total"] = parseFloat(total)
                invoiceObj["whtAmount"] = Math.abs(parseFloat(whtAmount));
                var idCreditMemo = results[0].getValue("applyingtransaction");

                var numberInstallments = 0;
                if (FEAT_INSTALLMENTS == "T" || FEAT_INSTALLMENTS == true) {
                    for (var i = 0; i < results.length; i++) {
                        var installmentNumber = results[i].getValue({ name: "installmentnumber", join: "installment" }) || "";
                        if (installmentNumber) {
                            var installmentTotal = results[i].getValue({ name: "fxamount", join: "installment" }) || 0.00;
                            invoiceObj[String(installmentNumber)] = { "total": parseFloat(installmentTotal) };
                            numberInstallments++;
                        }
                    }
                }

                if (numberInstallments && idCreditMemo) {
                    var whtRecord = record.load({
                        type: "creditmemo",
                        id: idCreditMemo
                    });

                    var numApply = whtRecord.getLineCount({ sublistId: "apply" });

                    for (var i = 0; i < numApply; i++) {
                        var internalid = whtRecord.getSublistValue({ sublistId: 'apply', fieldId: 'internalid', line: i });
                        var installmentNumber = whtRecord.getSublistValue({ sublistId: "apply", fieldId: "installmentnumber", line: i });
                        var amount = whtRecord.getSublistValue({ sublistId: "apply", fieldId: "amount", line: i }) || 0.00;
                        var isApplied = whtRecord.getSublistValue({ sublistId: "apply", fieldId: "apply", line: i });

                        if ((isApplied == true || isApplied == "T") && installmentNumber && invoiceObj[String(installmentNumber)]) {
                            invoiceObj[String(installmentNumber)]["whtAmount"] = parseFloat(amount);
                        }
                    }
                }
            }

            return invoiceObj;
        }


        function round2(num) {
            //return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-14) / 1e2);
            return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-11) / 1e2);
        }

        function round4(num) {
            return parseFloat(Math.round(parseFloat(num) * 1e4 + 1e-14) / 1e4);
        }

        return {
            voidPayment: voidPayment,
            beforeDeletePayment: beforeDeletePayment,
            deleteOtherChargesTransactions: deleteOtherChargesTransactions,
            createPayment: createPayment,
            getPaymentAccountingBooks: getPaymentAccountingBooks,
            getSetupTaxSubsidiary: getSetupTaxSubsidiary,
            crearNotaDebitoInteresMulta: crearNotaDebitoInteresMulta,
            applyInvoicesinPayment: applyInvoicesinPayment,
            updateBRTransactionFields: updateBRTransactionFields,
            createPaymentWhtTaxResults: createPaymentWhtTaxResults,
            createReclassJournalEntry: createReclassJournalEntry,
        }


    });
