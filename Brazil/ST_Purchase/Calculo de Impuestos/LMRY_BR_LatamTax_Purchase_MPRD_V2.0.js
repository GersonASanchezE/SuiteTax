/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                    ||
||                                                             ||
||  File Name: LMRY_BR_LatamTax_Purchase_MPRD_V2.0.js     	   ||
||                                                             ||
||  Version Date         Author        Remarks                 ||
||  2.0     Ago 21 2019  LatamReady    Use Script 2.0          ||
\= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/runtime', 'N/log', 'N/format',
    './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0',
    './Latam_Library/LMRY_BR_LatamTax_Purchase_LBRY_V2.0',
    './Latam_Library/LMRY_BR_WHT_Tax_Result_LBRY_V2.0',
    './Latam_Library/LMRY_BR_ST_Purchase_Tax_Transaction_LBRY_V2.0',
    // './Latam_Library/LMRY_BR_ST_LatamTax_Purchase_LBRY_V2.0',
    './Latam_Library/LMRY_Log_LBRY_V2.0',
    './Latam_Library/LMRY_BR_Withholding_Tax_Purchase_LBRY'],

    function (record, search, runtime, log, format, libraryMail, libraryTaxPurchase, libraryRetenciones, BR_TaxLibrary, lbryLog, libraryRetencionesLatam) {

        // Define characters that should not be counted when the script performs its
        // analysis of the text.
        var LMRY_script = 'LatamReady - BR LatamTax Purchase MPRD';
        var ST_FEATURE = false;

        var idLogRecord = runtime.getCurrentScript().getParameter({
            name: 'custscript_lmry_br_latamtax_pur_mprd'
        });


        function getInputData() {
            // Use the getInputData function to return two strings.
            log.debug('idLogRecord', idLogRecord);

            var logRecord = search.lookupFields({
                type: 'customrecord_lmry_br_latamtax_pur_log',
                id: idLogRecord,
                columns: ['custrecord_lmry_br_pur_log_transactions']
            });
            logRecord = logRecord.custrecord_lmry_br_pur_log_transactions;

            var arrayID = logRecord.split('|');

            if (arrayID.length) {
                record.submitFields({
                    type: 'customrecord_lmry_br_latamtax_pur_log',
                    id: idLogRecord,
                    values: {
                        custrecord_lmry_br_pur_log_status: '1'
                    },
                    options: {
                        enableSourcing: true,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });
                var searchTran = search.create({
                    type: 'transaction',
                    filters: [
                        ['internalid', 'anyof', arrayID], 'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: [
                        'internalid', 'type'
                    ]
                });
                return searchTran;
            }

            record.submitFields({
                type: 'customrecord_lmry_br_latamtax_pur_log',
                id: idLogRecord,
                values: {
                    custrecord_lmry_br_pur_log_status: '2',
                    custrecord_lmry_br_pur_log_comments: 'No transaction processed'
                },
                options: {
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                }
            });
            return [];

        }

        function reduce(context){

          try{

            var searchResult = context.values;
            searchResult = JSON.parse(searchResult[0]);

            var TranID = searchResult.id;
            var TranType = searchResult.values.type.value;

            ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

            var typeTran = '';
            switch (TranType) {
                case 'VendBill':
                    typeTran = 'vendorbill';
                    break;
                case 'VendCred':
                    typeTran = 'vendorcredit';
                    break;
                case 'PurchOrd':
                    typeTran = 'purchaseorder';
                    break;
                case 'ItemShip':
                    typeTran = 'itemfulfillment';
                    break;
                case 'CardChrg':
                    typeTran = 'creditcardcharge';
                    break;
                case 'CardRfnd':
                    typeTran = 'creditcardrefund';
                    break;
            }

            var recordObj = "";
            if (ST_FEATURE == true || ST_FEATURE == "T") {
                recordObj = record.load({
                    type: typeTran,
                    id: TranID,
                    isDynamic: true
                });
            } else {
                recordObj = record.load({
                    type: typeTran,
                    id: TranID
                });
            }

            var processed = recordObj.getValue("custbody_lmry_scheduled_process");
            /*if (processed == true || processed == "T") {
                log.debug("[ map ]", "Transaction ID: " + TranID + " has already been processed.");
                return;
            }*/

            var subsidiaryId = "";
            var licenses = [];

            var FEAT_SUBS = runtime.isFeatureInEffect({
                feature: "SUBSIDIARIES"
            });
            if (FEAT_SUBS == true || FEAT_SUBS == "T") {
                subsidiaryId = recordObj.getValue("subsidiary");
                licenses = libraryMail.getLicenses(subsidiaryId);
            } else {
                licenses = libraryMail.getLicenses(1);
            }

            var featureDifalAuto = libraryMail.getAuthorization(648, licenses);

            //Setup Tax Subsidiary: Json tb usado en retenciones Latam (No Condicionar) [18-08-2021]
            var setupTax = "";
            if (ST_FEATURE == true || ST_FEATURE == "t") {
                setupTax = BR_TaxLibrary.getSetupTaxSubsidiary(subsidiaryId);
            } else {
                setupTax = libraryTaxPurchase.getSetupTaxSubsidiary(subsidiaryId);
            }
            log.debug("setupTax", JSON.stringify(setupTax));

            var Jsonresult = {};
            if (ST_FEATURE === true || ST_FEATURE === "T") {
                Jsonresult = BR_TaxLibrary.getTaxPurchase(recordObj, setupTax, featureDifalAuto);
            } else {
                Jsonresult = libraryTaxPurchase.getTaxPurchase(recordObj, setupTax, featureDifalAuto);
            }

            log.debug('Jsonresult', Jsonresult);

            var cantItems = recordObj.getLineCount({
                sublistId: 'item'
            });

            var taxCalculationForm = setupTax["taxFlow"];

            for (var i = 0; i < cantItems; i++) {
                var wtaxLine = recordObj.getSublistValue('item', 'custcol_4601_witaxline', i);
                var isWtax = false;
                if (wtaxLine == true || wtaxLine == 'T') {
                    isWtax = true;
                }
                if (!isWtax) {
                    if (ST_FEATURE === true || ST_FEATURE === "T") {
                        BR_TaxLibrary.updateItemLine(Jsonresult, recordObj, i, taxCalculationForm);
                    } else {
                        libraryTaxPurchase.updateLine(Jsonresult, recordObj, i, taxCalculationForm);
                    }
                }
            }

            if (Number(taxCalculationForm) == 4 && typeTran != "itemfulfillment") {
                libraryTaxPurchase.addTaxItems(recordObj, Jsonresult, setupTax["department"], setupTax["class"], setupTax["location"]);
            }


            recordObj.setValue({
                fieldId: 'custbody_lmry_scheduled_process',
                value: true
            });

            //RETENCIONES ESTANDAR SOLO SI EL FEATURE DE RETENCIONES LATAM ESTA DESACTIVADO
            if (taxCalculationForm == 4 && TranType == 'VendBill' && !libraryMail.getAuthorization(670, licenses)) {
                deleteTaxResults(TranID);
                libraryRetenciones.createTaxResults(TranID);
            }

            var arrayTR = [];
            if (ST_FEATURE === true || ST_FEATURE === "T") {
                arrayTR = BR_TaxLibrary.createTaxResult(Jsonresult, recordObj, featureDifalAuto);
            } else {
                arrayTR = libraryTaxPurchase.createTaxResult(Jsonresult, recordObj, featureDifalAuto);
            }

            log.debug('arrayTR', arrayTR.join('|'));

            recordObj.setValue({
                fieldId: 'custbody_lmry_scheduled_process',
                value: true
            });

            recordObj.save({
                ignoreMandatoryFields: true,
                enableSourcing: true,
                disableTriggers: true
            });

            //CREDIT CARD: CREACION JOURNAL
            if(TranType == 'CardChrg' || TranType == 'CardRfnd'){
              libraryTaxPurchase.createJournalCreditCard(recordObj, setupTax);
            }

            //NUEVO RETENCIONES LATAM: 18-08-21

            if(libraryMail.getAuthorization(670, licenses)){

              log.debug('----------','Inicio Libreria Retenciones Latam');

              libraryRetencionesLatam.getWithholdingTax(recordObj, setupTax);
            }

            //

            context.write({
                key: TranID,
                value: {
                    id: TranID
                }
            });


          } catch (err) {

            var searchResult = context.values;
            searchResult = JSON.parse(searchResult[0]);

            var TranID = searchResult.id;

            context.write({
                key: TranID,
                value: {
                    error: err.message
                }
            });
            log.error('Error: ', err);
            lbryLog.doLog({ title: "[ map ]", message: err });

          }

        }

        function summarize(context) {
            try {
                var Errors = {};

                context.output.iterator().each(function (key, value) {
                    var obj = JSON.parse(value);

                    if (obj.error != null && obj.error != '') {
                        Errors[key] = obj.error;
                    }

                    return true;
                });

                var keys = Object.keys(Errors);
                if (keys.length) {
                    record.submitFields({
                        type: 'customrecord_lmry_br_latamtax_pur_log',
                        id: idLogRecord,
                        values: {
                            custrecord_lmry_br_pur_log_status: '3',
                            custrecord_lmry_br_pur_log_comments: JSON.stringify(Errors)
                        },
                        options: {
                            enableSourcing: true,
                            ignoreMandatoryFields: true,
                            disableTriggers: true
                        }
                    });
                } else {
                    record.submitFields({
                        type: 'customrecord_lmry_br_latamtax_pur_log',
                        id: idLogRecord,
                        values: {
                            custrecord_lmry_br_pur_log_status: '2'
                        },
                        options: {
                            enableSourcing: true,
                            ignoreMandatoryFields: true,
                            disableTriggers: true
                        }
                    });
                }


            } catch (err) {
                log.error('[summarize]', err);
                lbryLog.doLog({ title: "[ summarize ]", message: err });
            }

        }

        function getExchangeRate(recordObj, currencySetup, featureSubs, featureMB) {
            /*******************************************************************************************
             * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
             *******************************************************************************************/

            var exchangeRate = 1;

            if (featureSubs && featureMB) { // OneWorld y Multibook
                var subsidiary = recordObj.getValue({
                    fieldId: 'subsidiary'
                });
                var currencySubs = search.lookupFields({
                    type: 'subsidiary',
                    id: subsidiary,
                    columns: ['currency']
                });
                currencySubs = currencySubs.currency[0].value;

                if (currencySubs != currencySetup && currencySetup != '' && currencySetup != null) {
                    var lineasBook = recordObj.getLineCount({
                        sublistId: 'accountingbookdetail'
                    });
                    if (lineasBook != null && lineasBook != '') {
                        for (var i = 0; i < lineasBook; i++) {
                            var lineaCurrencyMB = recordObj.getSublistValue({
                                sublistId: 'accountingbookdetail',
                                fieldId: 'currency',
                                line: i
                            });
                            if (lineaCurrencyMB == currencySetup) {
                                exchangeRate = recordObj.getSublistValue({
                                    sublistId: 'accountingbookdetail',
                                    fieldId: 'exchangerate',
                                    line: i
                                });
                                break;
                            }
                        }
                    }
                } else { // La moneda de la subsidiaria es igual a la moneda del setup
                    exchangeRate = recordObj.getValue({
                        fieldId: 'exchangerate'
                    });
                }
            } else { // No es OneWorld o no tiene Multibook
                exchangeRate = recordObj.getValue({
                    fieldId: 'exchangerate'
                });
            }
            exchangeRate = parseFloat(exchangeRate);

            return exchangeRate;
        }

        function deleteTaxResults(IDTran) {
            if (IDTran) {
                try {
                    var searchTaxResults = search.create({
                        type: 'customrecord_lmry_br_transaction',
                        filters: [
                            ['custrecord_lmry_br_transaction', 'is', IDTran], 'AND',
                            ['custrecord_lmry_tax_type', 'anyof', '1']
                        ],
                        columns: ['internalid']
                    });

                    var results = searchTaxResults.run().getRange(0, 1000);
                    if (results != null && results != '') {
                        for (var i = 0; i < results.length; i++) {
                            var internalid = results[i].getValue('internalid');
                            record.delete({
                                type: 'customrecord_lmry_br_transaction',
                                id: internalid
                            });
                        }
                    }
                } catch (err) {
                    log.error('Error [ deleteTaxResults ] ', err);
                }
            }
            return true;
        }

        return {
            getInputData: getInputData,
            //map: map,
            reduce: reduce,
            summarize: summarize
        };
    });
