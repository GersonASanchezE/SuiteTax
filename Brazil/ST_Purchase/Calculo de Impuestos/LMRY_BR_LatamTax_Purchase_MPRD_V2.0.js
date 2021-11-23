/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                    ||
||                                                             ||
||  File Name: LMRY_BR_LatamTax_Purchase_MPRD_V2.0.js     	   ||
||                                                             ||
||  Version Date         Author        Remarks                 ||
||  1.0     Ago 21 2019  LatamReady    Use Script 2.0          ||
\= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */

define(['N/record', 'N/search', 'N/runtime', 'N/log', 'N/format',
    './Latam_Library/LMRY_BR_LatamTax_Purchase_LBRY_V2.0',
    './Latam_Library/LMRY_BR_WHT_Tax_Result_LBRY_V2.0',
    './Latam_Library/LMRY_BR_ST_LatamTax_Purchase_LBRY_V2.0'],

    function (record, search, runtime, log, format, libraryTaxPurchase, libraryRetenciones, ST_TaxPurchase) {

        // Define characters that should not be counted when the script performs its
        // analysis of the text.
        var LMRY_script = 'LatamReady - BR LatamTax Purchase MPRD';
        var ST_FEATURE = false;

        var idLogRecord = runtime.getCurrentScript().getParameter({
            name: 'custscript_lmry_br_latamtax_pur_mprd'
        });


        function getInputData() {
            // Use the getInputData function to return two strings.
            log.error('idLogRecord', idLogRecord);

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

        function map(context) {
            try {
                var searchResult = JSON.parse(context.value);

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
                }

                var Jsonresult = {};
                if (ST_FEATURE === true || ST_FEATURE === "T") {
                    Jsonresult = ST_TaxPurchase.getTaxPurchase(TranID, typeTran);
                } else {
                    Jsonresult = libraryTaxPurchase.getTaxPurchase(TranID, typeTran);
                }

                log.error('Jsonresult', Jsonresult);
                var recordObj = record.load({
                    type: typeTran,
                    id: TranID
                });

                var featureSubs = runtime.isFeatureInEffect({
                    feature: "SUBSIDIARIES"
                });
                var featureMB = runtime.isFeatureInEffect({
                    feature: "MULTIBOOK"
                });

                //Setup Tax Subsidiary
                var searchSetupSubsidiary = search.create({
                    type: "customrecord_lmry_setup_tax_subsidiary",
                    filters: [
                        ['isinactive', 'is', 'F']
                    ],
                    columns: ['custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_br_ap_flow',
                        'custrecord_lmry_setuptax_department', 'custrecord_lmry_setuptax_class', 'custrecord_lmry_setuptax_location']
                });
                if (featureSubs) {
                    var subsidiary = recordObj.getValue({
                        fieldId: 'subsidiary'
                    });
                    searchSetupSubsidiary.filters.push(search.createFilter({
                        name: 'custrecord_lmry_setuptax_subsidiary',
                        operator: 'is',
                        values: subsidiary
                    }));
                }
                var resultSearchSub = searchSetupSubsidiary.run().getRange(0, 1);

                var currencySetup = '';
                var taxCalculationForm = '', departmentSetup = "", classSetup = "", locationSetup = "";
                if (resultSearchSub != null && resultSearchSub != '') {
                    currencySetup = resultSearchSub[0].getValue('custrecord_lmry_setuptax_currency');
                    taxCalculationForm = resultSearchSub[0].getValue('custrecord_lmry_setuptax_br_ap_flow');
                    if (taxCalculationForm == '' || taxCalculationForm == null) {
                        taxCalculationForm = 1;
                    }
                    departmentSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_department");
                    classSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_class");
                    locationSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_location");
                }

                var cantItems = recordObj.getLineCount({
                    sublistId: 'item'
                });
                for (var i = 0; i < cantItems; i++) {
                    var wtaxLine = recordObj.getSublistValue('item', 'custcol_4601_witaxline', i);
                    var isWtax = false;
                    if (wtaxLine == true || wtaxLine == 'T') {
                        isWtax = true;
                    }
                    if (!isWtax) {
                        if (ST_FEATURE === true || ST_FEATURE === "T") {
                            ST_TaxPurchase.updateLine(Jsonresult, recordObj, i, taxCalculationForm);
                        } else {
                            libraryTaxPurchase.updateLine(Jsonresult, recordObj, i, taxCalculationForm);
                        }
                    }

                }

                if (Number(taxCalculationForm) == 4) {
                    libraryTaxPurchase.addTaxItems(recordObj, Jsonresult, departmentSetup, classSetup, locationSetup);
                }

                var generated = false;
                for (var key in Jsonresult) {
                    generated = true;
                }

                recordObj.setValue({
                    fieldId: 'custbody_lmry_scheduled_process',
                    value: true
                });

                if (taxCalculationForm == 4 && TranType == 'VendBill') {
                    deleteTaxResults(TranID);
                    libraryRetenciones.createTaxResults(TranID);
                }

                var exchRate = getExchangeRate(recordObj, currencySetup, featureSubs, featureMB);

                var arrayTR = [];
                if (ST_FEATURE === true || ST_FEATURE === "T") {
                    arrayTR = ST_TaxPurchase.createTaxResult(Jsonresult, recordObj, exchRate);
                } else {
                    arrayTR = libraryTaxPurchase.createTaxResult(Jsonresult, recordObj, exchRate);
                }
                log.error('arrayTR', arrayTR.join('|'));

                recordObj.save({
                    ignoreMandatoryFields: true,
                    enableSourcing: true,
                    disableTriggers: true
                });

                context.write({
                    key: TranID,
                    value: {
                        id: TranID
                    }
                });

            } catch (err) {
                var searchResult = JSON.parse(context.value);

                var TranID = searchResult.id;

                context.write({
                    key: TranID,
                    value: {
                        error: err.message
                    }
                });
                log.error('Error: ', err);
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
            map: map,
            summarize: summarize
        };
    });
