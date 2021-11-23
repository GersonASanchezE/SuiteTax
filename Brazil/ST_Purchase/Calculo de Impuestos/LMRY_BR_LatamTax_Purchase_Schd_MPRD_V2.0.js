/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                    ||
||                                                             ||
||  File Name: LMRY_BR_LatamTax_Purchase_Schd_MPRD_V2.0.js     ||
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
    './Latam_Library/LMRY_BR_LatamTax_Purchase_Schd_LBRY_V2.0',
    './Latam_Library/LMRY_BR_WHT_Tax_Result_LBRY_V2.0',
    './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0',
    './Latam_Library/LMRY_BR_ST_LatamTax_Purchase_Schd_LBRY_V2.0'],

    function (record, search, runtime, log, format, libraryTaxPurchase, libraryRetenciones, libraryMail, ST_TaxPurchase) {

        // Define characters that should not be counted when the script performs its
        // analysis of the text.
        var LMRY_script = 'LatamReady - BR LatamTax Purchase Schd MPRD';
        var ST_FEATURE = false;
        var FEAT_INSTALLMENTS = runtime.isFeatureInEffect({ feature: "installments" });

        function getInputData() {

          ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

          var transactionColumns = [
            search.createColumn({ name: "internalid", label: "Internal ID" }),
            search.createColumn({ name: "subsidiary", label: "Subsidiary" }),
            search.createColumn({ name: "trandate", label: "Date" }),
            search.createColumn({ name: "currency", label: "Currency" }),
            search.createColumn({ name: "exchangerate", label: "Exchange Rate" }),
            search.createColumn({ name: "custbody_lmry_scheduled_process", label: "Latam - Scheduled Process" }),
            search.createColumn({ name: "item", label: "Item" }),
            search.createColumn({ name: "custcol_lmry_br_tax_rule", label: "Latam Col - BR Tax Rule" }),
            search.createColumn({ name: "custcol_lmry_br_regimen", label: "Latam Col - BR Regimen" }),
            search.createColumn({ name: "fxamount", label: "Amount (Foreign Currency)" }),
            search.createColumn({ name: "custcol_lmry_br_cst_pis", label: "Latam Col - BR CST PIS" }),
            search.createColumn({ name: "custcol_lmry_br_cst_cofins", label: "Latam Col - BR CST COFINS" }),
            search.createColumn({ name: "custcol_lmry_br_cst_ipi", label: "Latam Col - BR CST IPI" }),
            search.createColumn({ name: "custcol_lmry_br_cst_icms", label: "Latam Col - BR CST ICMS" }),
            search.createColumn({ name: "lineuniquekey", label: "Line Unique Key" }),
            search.createColumn({ name: "statusref", label: "Status" }),
            search.createColumn({ name: "type", label: "Type" }),
            search.createColumn({ name: "linesequencenumber", label: "Line Sequence Number" }),
            search.createColumn({ name: "custbody_lmry_document_type", label: "Latam - Legal Document Type" }),
            search.createColumn({ name: "custbody_lmry_province", label: "Latam - Province" }),
            search.createColumn({ name: "custbody_lmry_city", label: "Latam - City" }),
            search.createColumn({ name: "custbody_lmry_district", label: "Latam - District" }),
            search.createColumn({ name: "custbody_lmry_apply_wht_code", label: "Latam - Applied WHT Code" }),
            search.createColumn({ name: "custcol_lmry_br_tran_mcn", label: "Latam Col - MCN Code" })
          ];

          if(ST_FEATURE === true || ST_FEATURE === "T") {
            transactionColumns.push(search.createColumn({ name: "taxrate", join: "taxDetail", label: "Rate" }));
            transactionColumns.push(search.createColumn({ name: "formulacurrency", formula: "ABS({fxamount}*({taxdetail.taxrate}/100))", label: "Tax" }))
          } else {
            transactionColumns.push(search.createColumn({ name: "rate", join: "taxItem", label: "Rate" }));
            transactionColumns.push(search.createColumn({ name: "formulacurrency", formula: "ABS({fxamount}*({taxitem.rate}/100))", label: "Tax" }));
          }

          try {
            var transactionSearchObj = search.create({
                type: "transaction",
                filters: [
                    ["mainline", "is", "F"],
                    "AND",
                    ["custcol_lmry_br_tax_rule", "noneof", "@NONE@"],
                    "AND",
                    ["custcol_lmry_ar_item_tributo", "is", "F"], "AND",
                    ["custbody_lmry_scheduled_process", "is", "F"],
                    "AND",
                    [
                        [
                            ["type", "anyof", "VendBill"], "AND",
                            ["voided", "is", "F"]
                        ], "OR",
                        ["type", "anyof", "VendCred", "PurchOrd"]
                    ],
                    "AND",
                    ["lastmodifieddate", "on", "today"],
                    "AND",
                    ["formulatext: CASE WHEN UPPER({type.id})=UPPER('VendBill') and {custbody_lmry_subsidiary_country.id}=30 and {custrecord_lmry_br_related_transaction.custrecord_lmry_br_block_taxes.id}= 1 THEN 1 ELSE 0 END", "is", "0"]
                ],
                columns: transactionColumns
            });

            return transactionSearchObj;

          } catch(e) {
            log.error('[ getInputData ]', e);
          }

        }

        function map(context) {
            try {
                var searchResult = JSON.parse(context.value);

                /*var TranID = searchResult.id;
                var TranType = searchResult.values.type.value;*/
                ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

                var transaccionObj = {};

                transaccionObj['internalid'] = searchResult.id;
                transaccionObj['type'] = searchResult.recordType;
                transaccionObj['subsidiary'] = searchResult.values.subsidiary ? searchResult.values.subsidiary.value : 1;
                transaccionObj['trandate'] = searchResult.values.trandate;
                transaccionObj['currency'] = searchResult.values.currency.value;
                transaccionObj['exchangerate'] = searchResult.values.exchangerate;
                transaccionObj['itemValue'] = searchResult.values.item.value;
                transaccionObj['itemName'] = searchResult.values.item.text;
                transaccionObj['rule'] = searchResult.values.custcol_lmry_br_tax_rule.value;

                transaccionObj['net'] = parseFloat(searchResult.values.fxamount);
                transaccionObj['tax'] = parseFloat(searchResult.values.formulacurrency);
                transaccionObj['lineuniquekey'] = searchResult.values.lineuniquekey;
                transaccionObj['linesequencenumber'] = parseInt(searchResult.values.linesequencenumber) - 1;
                transaccionObj['applyWht'] = searchResult.values.custbody_lmry_apply_wht_code;

                transaccionObj['regimen'] = searchResult.values.custcol_lmry_br_regimen ? searchResult.values.custcol_lmry_br_regimen.value : '';
                transaccionObj['cstpis'] = searchResult.values.custcol_lmry_br_cst_pis ? searchResult.values.custcol_lmry_br_cst_pis.value : '';
                transaccionObj['cstcofins'] = searchResult.values.custcol_lmry_br_cst_cofins ? searchResult.values.custcol_lmry_br_cst_cofins.value : '';
                transaccionObj['csticms'] = searchResult.values.custcol_lmry_br_cst_icms ? searchResult.values.custcol_lmry_br_cst_icms.value : '';
                transaccionObj['cstipi'] = searchResult.values.custcol_lmry_br_cst_ipi ? searchResult.values.custcol_lmry_br_cst_ipi.value : '';
                transaccionObj['document'] = searchResult.values.custbody_lmry_document_type ? searchResult.values.custbody_lmry_document_type.value : '';
                transaccionObj['province'] = searchResult.values.custbody_lmry_province ? searchResult.values.custbody_lmry_province.value : '';
                transaccionObj['city'] = searchResult.values.custbody_lmry_city ? searchResult.values.custbody_lmry_city.value : '';
                transaccionObj['district'] = searchResult.values.custbody_lmry_district ? searchResult.values.custbody_lmry_district.value : '';
                transaccionObj['mcnCode'] = searchResult.values.custcol_lmry_br_tran_mcn ? searchResult.values.custcol_lmry_br_tran_mcn.value : "";

                /******************************************
                 * Validación del feature por subsidiaria
                 ******************************************/
                var licenses = libraryMail.getLicenses(transaccionObj['subsidiary']);
                log.error('licenses', licenses);

                if (!libraryMail.getAuthorization(527, licenses)) {
                    return true;
                }

                /**************************************************
                 * Obtención de la configuracion de la subsidiaria
                 **************************************************/
                var featureMB = runtime.isFeatureInEffect({
                    feature: "MULTIBOOK"
                });

                var featureSubs = runtime.isFeatureInEffect({
                    feature: "SUBSIDIARIES"
                });

                var setupSubsi = {};
                //Setup Tax Subsidiary
                var searchSetupSubsidiary = search.create({
                    type: "customrecord_lmry_setup_tax_subsidiary",
                    filters: [
                        ['isinactive', 'is', 'F']
                    ],
                    columns: ['custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_br_ap_flow', 'custrecord_lmry_setuptax_type_rounding']
                });
                if (featureSubs) {
                    searchSetupSubsidiary.filters.push(search.createFilter({
                        name: 'custrecord_lmry_setuptax_subsidiary',
                        operator: 'is',
                        values: transaccionObj['subsidiary']
                    }));
                }
                var resultSearchSub = searchSetupSubsidiary.run().getRange(0, 1);

                var taxCalculationForm = '';
                if (resultSearchSub != null && resultSearchSub != '') {
                    setupSubsi['rounding'] = resultSearchSub[0].getValue('custrecord_lmry_setuptax_type_rounding');
                    setupSubsi['currency'] = resultSearchSub[0].getValue('custrecord_lmry_setuptax_currency');
                    taxCalculationForm = resultSearchSub[0].getValue('custrecord_lmry_setuptax_br_ap_flow');
                    if (taxCalculationForm == '' || taxCalculationForm == null) {
                        taxCalculationForm = '1';
                    }
                    setupSubsi['flow'] = taxCalculationForm;
                    setupSubsi["department"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_department") || "";
                    setupSubsi["class"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_class") || "";
                    setupSubsi["location"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_location") || "";
                }


                /*******************************************************************************************
                 * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
                 *******************************************************************************************/

                var exchangeRate = 1;

                if (featureSubs && featureMB) { // OneWorld y Multibook
                    var currencySubs = search.lookupFields({
                        type: 'subsidiary',
                        id: transaccionObj['subsidiary'],
                        columns: ['currency']
                    });
                    currencySubs = currencySubs.currency[0].value;

                    if (currencySubs != setupSubsi['currency'] && setupSubsi['currency'] != '' && setupSubsi['currency'] != null) {
                        var transactionSearchObj = search.create({
                            type: "transaction",
                            filters: [
                                ["mainline", "is", "T"],
                                "AND",
                                ["internalid", "is", transaccionObj['internalid']]
                            ],
                            columns: [
                                search.createColumn({
                                    name: "accountingbookid",
                                    join: "accountingTransaction",
                                    label: "Accounting Book ID"
                                }),
                                search.createColumn({
                                    name: "accountingbook",
                                    join: "accountingTransaction",
                                    label: "Accounting Book"
                                }),
                                search.createColumn({
                                    name: "basecurrency",
                                    join: "accountingTransaction",
                                    label: "Base Currency"
                                }),
                                search.createColumn({
                                    name: "exchangerate",
                                    join: "accountingTransaction",
                                    label: "Exchange Rate"
                                })
                            ]
                        });
                        transactionSearchObj = transactionSearchObj.run().getRange(0, 1000);

                        if (transactionSearchObj != null && transactionSearchObj != '') {
                            for (var i = 0; i < transactionSearchObj.length; i++) {
                                var col = transactionSearchObj[i].columns;
                                var lineaCurrencyMB = transactionSearchObj[i].getValue(col[2]);
                                if (lineaCurrencyMB == currencySetup) {
                                    exchangeRate = transactionSearchObj[i].getValue(col[3]);
                                }
                            }
                        }
                    } else { // La moneda de la subsidiaria es igual a la moneda del setup
                        exchangeRate = transaccionObj['exchangerate'];
                    }
                } else { // No es OneWorld o no tiene Multibook
                    exchangeRate = transaccionObj['exchangerate'];
                }
                exchangeRate = parseFloat(exchangeRate);
                log.error('LBRY - exchangeRate', exchangeRate);

                /******************************************************
                 * Obtención de la lista de retenciones para la linea
                 ******************************************************/
                var Jsonresult = {};
                if (ST_FEATURE === true || ST_FEATURE === "T") {
                    Jsonresult = ST_TaxPurchase.getTaxPurchaseLine(transaccionObj, setupSubsi, exchangeRate);
                } else {
                    Jsonresult = libraryTaxPurchase.getTaxPurchaseLine(transaccionObj, setupSubsi, exchangeRate);
                }
                log.error('Jsonresult', Jsonresult);


                var concatBooks = concatenarAccountingBooks(transaccionObj['internalid'], exchangeRate, featureMB);

                /******************************************************
                 * Creacion de los Tax Result obtenidos para la linea
                 ******************************************************/
                var arrayTR = [];
                if (ST_FEATURE === true || ST_FEATURE === "T") {
                    arrayTR = ST_TaxPurchase.createTaxResult(Jsonresult, transaccionObj['internalid'], concatBooks, exchangeRate);
                } else {
                    arrayTR = libraryTaxPurchase.createTaxResult(Jsonresult, transaccionObj['internalid'], concatBooks, exchangeRate);
                }
                log.error('arrayTR', arrayTR);

                context.write({
                    key: [transaccionObj['internalid'], transaccionObj['type'], setupSubsi['flow']].join('|'),
                    value: {
                        results: Jsonresult,
                        setupSegment: {
                            "department": setupSubsi["department"],
                            "class": setupSubsi["class"],
                            "location": setupSubsi["location"]
                        },
                    }
                });

            } catch (err) {
                log.error('Error: ', err);
            }

        }

        function reduce(context) {
            try {

                ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

                var TranID = parseInt(context.key.split('|')[0]);
                log.error("TranID", TranID);
                var TranType = context.key.split('|')[1];
                var taxCalculationForm = context.key.split('|')[2];
                if (taxCalculationForm == '' || taxCalculationForm == null) {
                    taxCalculationForm = '1';
                }

                var recordObj = record.load({
                    type: TranType,
                    id: TranID
                });

                var r_log = record.create({ type: 'customrecord_lmry_br_latamtax_pur_log' });
                r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_transactions', value: context.key.split('|')[0] });
                r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_subsidiary', value: recordObj.getValue('subsidiary') });
                r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_currency', value: recordObj.getValue('currency') });
                r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_period', value: recordObj.getValue('postingperiod') });
                r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_execute_type', value: 'Automatic' });
                r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_status', value: '1' });
                var id_return = r_log.save();

                if (TranType == 'vendorbill') {
                    if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
                        var isOverridedInstallments = recordObj.getValue("overrideinstallments");
                        if (isOverridedInstallments == 'T' || isOverridedInstallments == true) {
                            var total = recordObj.getValue('total');
                            var instTotal = 0;
                            var cant = recordObj.getLineCount({ sublistId: 'installment' });
                            for (var i = 0; i < cant; i++) {
                                var amount = recordObj.getSublistValue({ sublistId: 'installment', fieldId: 'amount', line: i });
                                instTotal = round2(instTotal + parseFloat(amount));
                            }

                            if (instTotal == 0) {
                                instTotal = total;
                            }

                            log.error("instTotal-total", [instTotal, total].join("-"));

                            if (instTotal != total) {
                                deleteTaxResults(TranID, '4');
                                record.submitFields({
                                    type: TranType,
                                    id: TranID,
                                    values: {
                                        custbody_lmry_scheduled_process: true
                                    },
                                    options: {
                                        enableSourcing: true,
                                        ignoreMandatoryFields: true,
                                        disableTriggers: true
                                    }
                                });
                                record.submitFields({
                                    type: 'customrecord_lmry_br_latamtax_pur_log',
                                    id: id_return,
                                    values: {
                                        custrecord_lmry_br_pur_log_status: '2',
                                        custrecord_lmry_br_pur_log_comments: 'The amount of the installments does not match the amount of the invoice'
                                    },
                                    options: {
                                        enableSourcing: true,
                                        ignoreMandatoryFields: true,
                                        disableTriggers: true
                                    }
                                });
                                return true;
                            }
                        }
                    }
                }

                var taxResults = [];

                var positions = getPositionsByLineUniqueKey(recordObj);
                log.error("positions", positions);

                for (var i = 0; i < context.values.length; i++) {
                    var Jsoncontext = JSON.parse(context.values[i]);
                    var Jsonresult = Jsoncontext.results;
                    if (Jsonresult != null && Jsonresult != '') {
                        var line = positions[Jsonresult[0].lineUniqueKey];
                        line = parseInt(line);
                        log.error("line", line);
                        if (line > -1) {
                            var wtaxLine = recordObj.getSublistValue('item', 'custcol_4601_witaxline', line);
                            var isWtax = false;
                            if (wtaxLine == true || wtaxLine == 'T') {
                                isWtax = true;
                            }
                            if (!isWtax) {
                                if (ST_FEATURE === true || ST_FEATURE === "T") {
                                    ST_TaxPurchase.updateLine(Jsonresult, recordObj, line, taxCalculationForm);
                                } else {
                                    libraryTaxPurchase.updateLine(Jsonresult, recordObj, line, taxCalculationForm);
                                }
                                taxResults = taxResults.concat(Jsonresult);
                            }
                        }
                    }
                }

                if (Number(taxCalculationForm) == 4 && taxResults.length) {

                    var departmentSetup = "", classSetup = "", locationSetup = "";
                    if (context.values && context.values.length) {
                        var contextObj = JSON.parse(context.values[0]);
                        if (contextObj && contextObj.setupSegment) {
                            departmentSetup = contextObj.setupSegment["department"] || "";
                            classSetup = contextObj.setupSegment["class"] || "";
                            locationSetup = contextObj.setupSegment["location"] || "";
                        }
                    }

                    log.error("taxResults", JSON.stringify(taxResults));
                    libraryTaxPurchase.addTaxItems(recordObj, taxResults, departmentSetup, classSetup, locationSetup);
                }


                recordObj.setValue({
                    fieldId: 'custbody_lmry_scheduled_process',
                    value: true
                });

                if (TranType == 'vendorbill') {
                    if (taxCalculationForm == 4) {
                        deleteTaxResults(TranID, '1');
                        libraryRetenciones.createTaxResults(TranID);
                    }
                }

                //Se actualiza la posicion de los tax results
                for (var i = 0; i < taxResults.length; i++) {
                    var internalId = taxResults[i]["internalid"];
                    var lineUniqueKey = taxResults[i]["lineUniqueKey"];
                    if (internalId) {
                        record.submitFields({
                            type: "customrecord_lmry_br_transaction",
                            id: internalId,
                            values: {
                                "custrecord_lmry_br_positem": positions[lineUniqueKey]
                            },
                            options: {
                                disableTriggers: true
                            }
                        })
                    }
                }

                var idRecord = recordObj.save({ ignoreMandatoryFields: true, enableSourcing: true, disableTriggers: true });
                log.error('idRecord: ', idRecord);

                record.submitFields({
                    type: 'customrecord_lmry_br_latamtax_pur_log',
                    id: id_return,
                    values: {
                        custrecord_lmry_br_pur_log_status: '2'
                    },
                    options: {
                        enableSourcing: true,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });

            } catch (err) {
                log.error("err", err);
                //library_email.sendemail('[reduce]' + err, LMRY_script);
                var TranID = context.key.split('|')[0];
                var searchLog = search.create({
                    type: 'customrecord_lmry_br_latamtax_pur_log',
                    filters: [
                        ['custrecord_lmry_br_pur_log_transactions', 'is', TranID], 'AND',
                        ['custrecord_lmry_br_pur_log_status', 'is', '1']
                    ],
                    columns: ['internalid']
                });
                searchLog = searchLog.run().getRange(0, 1);
                if (searchLog != '' && searchLog != null) {
                    record.submitFields({
                        type: 'customrecord_lmry_br_latamtax_pur_log',
                        id: searchLog[0].getValue('internalid'),
                        values: {
                            custrecord_lmry_br_pur_log_status: '3',
                            custrecord_lmry_br_pur_log_comments: err.message
                        },
                        options: {
                            enableSourcing: true,
                            ignoreMandatoryFields: true,
                            disableTriggers: true
                        }
                    });
                }

                log.error('[reduce]', err);
            }
        }

        function deleteTaxResults(IDTran, taxtype) {
            if (IDTran) {
                try {
                    var searchTaxResults = search.create({
                        type: 'customrecord_lmry_br_transaction',
                        filters: [
                            ['custrecord_lmry_br_transaction', 'is', IDTran], 'AND',
                            ['custrecord_lmry_tax_type', 'anyof', taxtype]
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

        /********************************************************
         * Concatena los libros contables en caso tenga Multibook
         ********************************************************/
        function concatenarAccountingBooks(internalid, exchangerate, featureMultiBook) {
            var auxBookMB = 0;
            var auxExchangeMB = parseFloat(exchangerate);

            if (featureMultiBook) {
                var transactionSearchObj = search.create({
                    type: "transaction",
                    filters: [
                        ["mainline", "is", "T"],
                        "AND",
                        ["internalid", "is", internalid]
                    ],
                    columns: [
                        search.createColumn({
                            name: "accountingbookid",
                            join: "accountingTransaction",
                            label: "Accounting Book ID"
                        }),
                        search.createColumn({
                            name: "accountingbook",
                            join: "accountingTransaction",
                            label: "Accounting Book"
                        }),
                        search.createColumn({
                            name: "basecurrency",
                            join: "accountingTransaction",
                            label: "Base Currency"
                        }),
                        search.createColumn({
                            name: "exchangerate",
                            join: "accountingTransaction",
                            label: "Exchange Rate"
                        })
                    ]
                });
                transactionSearchObj = transactionSearchObj.run().getRange(0, 1000);

                if (transactionSearchObj != null && transactionSearchObj != '') {
                    for (var i = 0; i < transactionSearchObj.length; i++) {
                        var col = transactionSearchObj[i].columns;
                        var lineaBook = transactionSearchObj[i].getValue(col[0]);
                        var lineaExchangeRate = transactionSearchObj[i].getValue(col[3]);
                        auxBookMB = auxBookMB + '|' + lineaBook;
                        auxExchangeMB = auxExchangeMB + '|' + lineaExchangeRate;
                    }
                }
            } // Fin Multibook
            return auxBookMB + '&' + auxExchangeMB;
        }

        function getPositionsByLineUniqueKey(recordObj) {
            var positions = {};
            var numItems = recordObj.getLineCount({ sublistId: "item" });
            for (var i = 0; i < numItems; i++) {
                var lineUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: i });
                positions[lineUniqueKey] = i;
            }
            return positions;
        }

        function round2(num) {
            if (num >= 0) {
                return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-3) / 1e2);
            } else {
                return parseFloat(Math.round(parseFloat(num) * 1e2 - 1e-3) / 1e2);
            }
        }


        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        };
    });
