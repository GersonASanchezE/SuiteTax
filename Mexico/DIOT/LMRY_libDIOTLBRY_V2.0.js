/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_libDIOTLBRY_V2.0.js                         ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 10 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
define(['N/record', 'N/runtime', 'N/search', './LMRY_libSendingEmailsLBRY_V2.0'],

    function (record, runtime, search, library) {

        /**
         * Function definition to be triggered before r
         ecord is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
                     */


        // Nombre del Reporte
        var namereport = 'LatamReady MX DIOT LBRY V2.0';
        var LMRY_script = 'LatamReady - DIOT LBRY V2.0';
        var intMaxMem = 200;
        var scriptObj = runtime.getCurrentScript();

        // Variable que almacena de Impuestos
        var JSON_Data = {};

        // Variables globales de Impuesto
        var diot_iva_smx = 0;
        var diot_iva_dsmx = 0;
        var diot_iva_ismx = 0;
        var diot_iva_iemx = 0;
        var diot_iva_zmx = 0;
        var diot_iva_emx = 0;
        var diot_iva_snocmx = 0;
        var diot_iva_inocmx = 0;
        var diot_iva_s8mx = 0;
        var diot_iva_s8nocmx = 0;
        var diot_iva_s4mx = 0;

        var diot_total_smx = 0;
        var diot_total_dsmx = 0;
        var diot_total_ismx = 0;
        var diot_total_iemx = 0;
        var diot_total_zmx = 0;
        var diot_total_emx = 0;
        var diot_total_snocmx = 0;
        var diot_total_inocmx = 0;
        var diot_total_s8mx = 0;
        var diot_total_s8nocmx = 0;
        var diot_total_s4mx = 0;

        var diot_ret_smx = 0;
        var diot_ret_dsmx = 0;
        var diot_ret_ismx = 0;
        var diot_ret_iemx = 0;
        var diot_ret_zmx = 0;
        var diot_ret_emx = 0;
        var diot_ret_snocmx = 0;
        var diot_ret_inocmx = 0;
        var diot_ret_s8mx = 0;
        var diot_ret_s8nocmx = 0;
        var diot_ret_s4mx = 0;

        var iva_devoluciones = 0;
        var IDOmitidos = [];

        function CalculoDIOT(recordObj) {

            try {

                reset();

                // Obtiene la transaccion
                //var recordObj = context.newRecord;
                if (recordObj.type == 'expensereport') {
                    ExpenseReportDIOT(recordObj);
                }
                else if (recordObj.type == 'vendorpayment') {
                    CalcularDIOTPayment(recordObj);
                }
                else if (recordObj.type == 'vendorbill') {
                    CalcularDIOTExpense(recordObj);
                    CalcularDIOTItem(recordObj);

                    var retTotalIva = calculatRetTotalIVA(recordObj);

                    var currency = recordObj.getValue({
                        fieldId: 'currency'
                    });
                    var exchangeRate = recordObj.getValue({
                        fieldId: 'exchangerate'
                    });
                    var entityID = recordObj.getValue({
                        fieldId: 'entity'
                    });
                    var opeType = recordObj.getValue({
                        fieldId: 'custbody_lmry_mx_operation_type'
                    });

                    var nettotal = recordObj.getValue('grosstotal');
                    var taxtotal = recordObj.getValue('taxtotal');
                    var grosstotal = recordObj.getValue('total');

                    JSON_Data['iva_smx'] = parseFloat(diot_iva_smx).toFixed(2);
                    JSON_Data['iva_dsmx'] = parseFloat(diot_iva_dsmx).toFixed(2);
                    JSON_Data['iva_ismx'] = parseFloat(diot_iva_ismx).toFixed(2);
                    JSON_Data['iva_iemx'] = parseFloat(diot_iva_iemx).toFixed(2);
                    JSON_Data['iva_zmx'] = parseFloat(diot_iva_zmx).toFixed(2);
                    JSON_Data['iva_emx'] = parseFloat(diot_iva_emx).toFixed(2);
                    JSON_Data['iva_snocmx'] = parseFloat(diot_iva_snocmx).toFixed(2);
                    JSON_Data['iva_inocmx'] = parseFloat(diot_iva_inocmx).toFixed(2);
                    JSON_Data['iva_s8mx'] = parseFloat(diot_iva_s8mx).toFixed(2);
                    JSON_Data['iva_s8nocmx'] = parseFloat(diot_iva_s8nocmx).toFixed(2);
                    JSON_Data['iva_s4mx'] = parseFloat(diot_iva_s4mx).toFixed(2);

                    JSON_Data['total_smx'] = parseFloat(diot_total_smx).toFixed(2);
                    JSON_Data['total_dsmx'] = parseFloat(diot_total_dsmx).toFixed(2);
                    JSON_Data['total_ismx'] = parseFloat(diot_total_ismx).toFixed(2);
                    JSON_Data['total_iemx'] = parseFloat(diot_total_iemx).toFixed(2);
                    JSON_Data['total_zmx'] = parseFloat(diot_total_zmx).toFixed(2);
                    JSON_Data['total_emx'] = parseFloat(diot_total_emx).toFixed(2);
                    JSON_Data['total_snocmx'] = parseFloat(diot_total_snocmx).toFixed(2);
                    JSON_Data['total_inocmx'] = parseFloat(diot_total_inocmx).toFixed(2);
                    JSON_Data['total_s8mx'] = parseFloat(diot_total_s8mx).toFixed(2);
                    JSON_Data['total_s8nocmx'] = parseFloat(diot_total_s8nocmx).toFixed(2);
                    JSON_Data['total_s4mx'] = parseFloat(diot_total_s4mx).toFixed(2);

                    JSON_Data['ret_smx'] = parseFloat(diot_ret_smx).toFixed(2);
                    JSON_Data['ret_dsmx'] = parseFloat(diot_ret_dsmx).toFixed(2);
                    JSON_Data['ret_ismx'] = parseFloat(diot_ret_ismx).toFixed(2);
                    JSON_Data['ret_iemx'] = parseFloat(diot_ret_iemx).toFixed(2);
                    JSON_Data['ret_zmx'] = parseFloat(diot_ret_zmx).toFixed(2);
                    JSON_Data['ret_emx'] = parseFloat(diot_ret_emx).toFixed(2);
                    JSON_Data['ret_snocmx'] = parseFloat(diot_ret_snocmx).toFixed(2);
                    JSON_Data['ret_inocmx'] = parseFloat(diot_ret_inocmx).toFixed(2);
                    JSON_Data['ret_s8mx'] = parseFloat(diot_ret_s8mx).toFixed(2);
                    JSON_Data['ret_s8nocmx'] = parseFloat(diot_ret_s8nocmx).toFixed(2);
                    JSON_Data['ret_s4mx'] = parseFloat(diot_ret_s4mx).toFixed(2);

                    JSON_Data['devoluciones'] = parseFloat(iva_devoluciones).toFixed(2);

                    JSON_Data["ret_total_iva"] = round2(retTotalIva);

                    var isNotEmpty = false;
                    for (var aux in JSON_Data) {
                        if (JSON_Data[aux] != 0) {
                            isNotEmpty = true;
                            break;
                        }
                    }
                    if (isNotEmpty) {
                        SaveRecordDIOT(recordObj, entityID, currency, exchangeRate, null, null, opeType, JSON_Data, nettotal, taxtotal, grosstotal, true);
                    }
                }
                else {
                    var currency = recordObj.getValue({
                        fieldId: 'currency'
                    });
                    var exchangeRate = recordObj.getValue({
                        fieldId: 'exchangerate'
                    });
                    var entityID = recordObj.getValue({
                        fieldId: 'entity'
                    });
                    var opeType = recordObj.getValue({
                        fieldId: 'custbody_lmry_mx_operation_type'
                    });

                    var grosstotal = recordObj.getValue({
                        fieldId: 'total'
                    });

                    var taxtotal = recordObj.getValue({
                        fieldId: 'taxtotal'
                    });

                    var nettotal = grosstotal - taxtotal;

                    var tranRelated = recordObj.getValue({
                        fieldId: 'createdfrom'
                    });
                    if (tranRelated == '' || tranRelated == null) {
                        var cant = recordObj.getLineCount({ sublistId: 'apply' });
                        for (var i = 0; i < cant; i++) {
                            var aplica = recordObj.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i
                            });
                            if (aplica == true || aplica == 'T') {
                                tranRelated = recordObj.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'internalid',
                                    line: i
                                });
                                break;
                            }

                        }

                    }

                    iva_devoluciones = parseFloat(iva_devoluciones) + parseFloat(grosstotal);
                    JSON_Data['devoluciones'] = iva_devoluciones.toFixed(2);

                    SaveRecordDIOT(recordObj, entityID, currency, exchangeRate, null, tranRelated, opeType, JSON_Data, nettotal, taxtotal, grosstotal, true);
                }

            } catch (error) {
                // Debug
                library.sendemail('Calculo_DIOT - Error: ' + error, LMRY_script);
            }

            // Termina el proceso
            return true;
        }

        function CalcularDIOTItem(recordObj) {
            // Tipo de cambio
            var tipocamb = recordObj.getValue({
                fieldId: 'exchangerate'
            });

            // Sub-lista de Gastos
            var lineNum = recordObj.getLineCount({
                sublistId: 'item'
            });

            for (var ind = 0; ind < lineNum; ind++) {
                // Importe
                var amount = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: ind
                });

                var whttaxamount = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_4601_witaxamount',
                    line: ind
                });

                var amountTotal = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: ind
                });

                if (amount == '' || amount == null) {
                    amount = 0;
                } else {
                    if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                        amountTotal = parseFloat(amountTotal) + parseFloat(whttaxamount);
                    }
                    else {
                        amountTotal = parseFloat(amountTotal);
                    }
                }



                // Verifica el tipo de impuesto
                var taxcode = recordObj.getSublistText({
                    sublistId: 'item',
                    fieldId: 'taxcode',
                    line: ind
                });

                var typeLine = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemtype',
                    line: ind
                });

                if (typeLine == 'Discount') {
                    var transacType = recordObj.getValue({
                        fieldId: 'type'
                    });
                    if (transacType == 'vendbill') {
                        var indice = taxcode.indexOf('UNDEF');
                        if (indice == -1) {
                            iva_devoluciones = parseFloat(iva_devoluciones) + Math.abs(parseFloat(amount));
                        }
                    }
                }
                else {
                    taxcode = taxcode.toUpperCase();
                    switch (taxcode) {
                        case 'VAT_MX:S-MX':
                            diot_iva_smx = parseFloat(diot_iva_smx) + parseFloat(amount);
                            diot_total_smx = parseFloat(diot_total_smx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_smx = parseFloat(diot_ret_smx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:DS-MX':
                            diot_iva_dsmx = parseFloat(diot_iva_dsmx) + parseFloat(amount);
                            diot_total_dsmx = parseFloat(diot_total_dsmx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_dsmx = parseFloat(diot_ret_dsmx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:IS-MX':
                            diot_iva_ismx = parseFloat(diot_iva_ismx) + parseFloat(amount);
                            diot_total_ismx = parseFloat(diot_total_ismx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_ismx = parseFloat(diot_ret_ismx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:IE-MX':
                            diot_iva_iemx = parseFloat(diot_iva_iemx) + parseFloat(amount);
                            diot_total_iemx = parseFloat(diot_total_iemx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_iemx = parseFloat(diot_ret_iemx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:Z-MX':
                            diot_iva_zmx = parseFloat(diot_iva_zmx) + parseFloat(amount);
                            diot_total_zmx = parseFloat(diot_total_zmx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_zmx = parseFloat(diot_ret_zmx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:E-MX':
                            diot_iva_emx = parseFloat(diot_iva_emx) + parseFloat(amount);
                            diot_total_emx = parseFloat(diot_total_emx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_emx = parseFloat(diot_ret_emx) + parseFloat(whttaxamount);
                            }
                            break;

                        case 'VAT_MX:SNOC-MX':
                            diot_iva_snocmx = parseFloat(diot_iva_snocmx) + parseFloat(amount);
                            diot_total_snocmx = parseFloat(diot_total_snocmx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_snocmx = parseFloat(diot_ret_snocmx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:INOC-MX':
                            diot_iva_inocmx = parseFloat(diot_iva_inocmx) + parseFloat(amount);
                            diot_total_inocmx = parseFloat(diot_total_inocmx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_inocmx = parseFloat(diot_ret_inocmx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:S8-MX':
                            diot_iva_s8mx = parseFloat(diot_iva_s8mx) + parseFloat(amount);
                            diot_total_s8mx = parseFloat(diot_total_s8mx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_s8mx = parseFloat(diot_ret_s8mx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:S4-MX':
                            diot_iva_s4mx = parseFloat(diot_iva_s4mx) + parseFloat(amount);
                            diot_total_s4mx = parseFloat(diot_total_s4mx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_s4mx = parseFloat(diot_ret_s4mx) + parseFloat(whttaxamount);
                            }
                            break;
                        case 'VAT_MX:S8NOC-MX':
                            diot_iva_s8nocmx = parseFloat(diot_iva_s8nocmx) + parseFloat(amount);
                            diot_total_s8nocmx = parseFloat(diot_total_s8nocmx) + parseFloat(amountTotal);
                            if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                                diot_ret_s8nocmx = parseFloat(diot_ret_s8nocmx) + parseFloat(whttaxamount);
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
        }

        function CalcularDIOTExpense(recordObj) {
            // Tipo de cambio
            var tipocamb = recordObj.getValue({
                fieldId: 'exchangerate'
            });

            // Sub-lista de Gastos
            var lineNum = recordObj.getLineCount({
                sublistId: 'expense'
            });

            for (var ind = 0; ind < lineNum; ind++) {

                // Importe
                var amount = recordObj.getSublistValue({
                    sublistId: 'expense',
                    fieldId: 'amount',
                    line: ind
                });

                var whttaxamount = recordObj.getSublistValue({
                    sublistId: 'expense',
                    fieldId: 'custcol_4601_witaxamt_exp',
                    line: ind
                });

                var amountTotal = recordObj.getSublistValue({
                    sublistId: 'expense',
                    fieldId: 'grossamt',
                    line: ind
                });

                if (amount == '' || amount == null) {
                    amount = 0;
                } else {
                    if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                        amountTotal = parseFloat(amountTotal) + parseFloat(whttaxamount);
                    }
                    else {
                        amountTotal = parseFloat(amountTotal);
                    }
                }

                // Verifica el tipo de impuesto
                var taxcode = recordObj.getSublistText({
                    sublistId: 'expense',
                    fieldId: 'taxcode',
                    line: ind
                });

                taxcode = taxcode.toUpperCase();
                switch (taxcode) {
                    case 'VAT_MX:S-MX':
                        diot_iva_smx = parseFloat(diot_iva_smx) + parseFloat(amount);
                        diot_total_smx = parseFloat(diot_total_smx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_smx = parseFloat(diot_ret_smx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:DS-MX':
                        diot_iva_dsmx = parseFloat(diot_iva_dsmx) + parseFloat(amount);
                        diot_total_dsmx = parseFloat(diot_total_dsmx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_dsmx = parseFloat(diot_ret_dsmx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:IS-MX':
                        diot_iva_ismx = parseFloat(diot_iva_ismx) + parseFloat(amount);
                        diot_total_ismx = parseFloat(diot_total_ismx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_ismx = parseFloat(diot_ret_ismx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:IE-MX':
                        diot_iva_iemx = parseFloat(diot_iva_iemx) + parseFloat(amount);
                        diot_total_iemx = parseFloat(diot_total_iemx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_iemx = parseFloat(diot_ret_iemx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:Z-MX':
                        diot_iva_zmx = parseFloat(diot_iva_zmx) + parseFloat(amount);
                        diot_total_zmx = parseFloat(diot_total_zmx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_zmx = parseFloat(diot_ret_zmx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:E-MX':
                        diot_iva_emx = parseFloat(diot_iva_emx) + parseFloat(amount);
                        diot_total_emx = parseFloat(diot_total_emx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_emx = parseFloat(diot_ret_emx) + parseFloat(whttaxamount);
                        }
                        break;

                    case 'VAT_MX:SNOC-MX':
                        diot_iva_snocmx = parseFloat(diot_iva_snocmx) + parseFloat(amount);
                        diot_total_snocmx = parseFloat(diot_total_snocmx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_snocmx = parseFloat(diot_ret_snocmx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:INOC-MX':
                        diot_iva_inocmx = parseFloat(diot_iva_inocmx) + parseFloat(amount);
                        diot_total_inocmx = parseFloat(diot_total_inocmx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_inocmx = parseFloat(diot_ret_inocmx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:S8-MX':
                        diot_iva_s8mx = parseFloat(diot_iva_s8mx) + parseFloat(amount);
                        diot_total_s8mx = parseFloat(diot_total_s8mx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_s8mx = parseFloat(diot_ret_s8mx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:S4-MX':
                        diot_iva_s4mx = parseFloat(diot_iva_s4mx) + parseFloat(amount);
                        diot_total_s4mx = parseFloat(diot_total_s4mx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_s4mx = parseFloat(diot_ret_s4mx) + parseFloat(whttaxamount);
                        }
                        break;
                    case 'VAT_MX:S8NOC-MX':
                        diot_iva_s8nocmx = parseFloat(diot_iva_s8nocmx) + parseFloat(amount);
                        diot_total_s8nocmx = parseFloat(diot_total_s8nocmx) + parseFloat(amountTotal);
                        if (whttaxamount != '' && whttaxamount != null && whttaxamount != 0) {
                            diot_ret_s8nocmx = parseFloat(diot_ret_s8nocmx) + parseFloat(whttaxamount);
                        }
                        break;
                    default:
                        break;
                }

            }
        }

        function ExpenseReportDIOT(recordObj) {

            // Sub-lista de Gastos
            var filtersEx = new Array();
            filtersEx[0] = search.createFilter({
                name: 'custrecord_lmry_mx_transaction',
                operator: search.Operator.IS,
                values: recordObj.id
            });
            var recordsearch = search.create({
                type: 'customrecord_lmry_mx_transaction_fields',
                columns: ['internalid'],
                filters: filtersEx
            });
            var recordresult = recordsearch.run().getRange(0, 1000);
            var recordid = 0;

            if (recordresult != null && recordresult != '') {
                for (var i = 0; i < recordresult.length; i++) {
                    recordid = recordresult[i].getValue('internalid');
                    record.delete({ type: 'customrecord_lmry_mx_transaction_fields', id: recordid });
                }
            }

            var filtersRd = new Array();
            filtersRd[0] = search.createFilter({
                name: 'custrecord_lmry_mx_transaction_related',
                operator: search.Operator.IS,
                values: recordObj.id
            });
            recordsearch = search.create({
                type: 'customrecord_lmry_mx_transaction_fields',
                columns: ['internalid'],
                filters: filtersRd
            });
            recordresult = recordsearch.run().getRange(0, 1000);

            if (recordresult != null && recordresult != '') {
                for (var i = 0; i < recordresult.length; i++) {
                    recordid = recordresult[i].getValue('internalid');
                    record.delete({ type: 'customrecord_lmry_mx_transaction_fields', id: recordid });
                }
            }


            var opeType = recordObj.getValue({
                fieldId: 'custbody_lmry_mx_operation_type'
            });
            var lineNum = recordObj.getLineCount({
                sublistId: 'expense'
            });
            var tipocamb = recordObj.getValue({
                fieldId: 'expensereportexchangerate'
            });
            var currency = recordObj.getValue({
                fieldId: 'expensereportcurrency'
            });

            var nettotal = recordObj.getValue({
                fieldId: 'expense_total'
            });
            var taxtotal = recordObj.getValue({
                fieldId: 'tax1amt'
            });
            var grosstotal = recordObj.getValue({
                fieldId: 'total'
            });

            nettotal = nettotal ? nettotal : grosstotal - taxtotal;
            /*var currency;
            var subsi = recordObj.getValue({ fieldId: 'subsidiary' });
            var subsiCurrency = search.lookupFields({
                type: 'subsidiary',
                id: subsi,
                columns: ['currency']
            });
            if (subsiCurrency != null && subsiCurrency != '') {
                currency = subsiCurrency.currency[0].value;
            }
            var tipocamb = 1;*/
            var savetotal = true;

            for (var ind = 0; ind < lineNum; ind++) {


                var vendorID = recordObj.getSublistValue({
                    sublistId: 'expense',
                    fieldId: 'custcol_lmry_exp_rep_vendor_colum',
                    line: ind
                });
                if (vendorID == null || vendorID == '') {
                    continue;
                }

                // Reinicia los valores
                JSON_Data = {};

                // Importe
                var amount = recordObj.getSublistValue({
                    sublistId: 'expense',
                    fieldId: 'amount',
                    line: ind
                });

                // Verifica el tipo de impuesto
                var taxcode = recordObj.getSublistText({
                    sublistId: 'expense',
                    fieldId: 'taxcode',
                    line: ind
                });

                taxcode = taxcode.toUpperCase();
                switch (taxcode) {
                    case 'VAT_MX:S-MX':
                        JSON_Data['iva_smx'] = parseFloat(amount);
                        JSON_Data['total_smx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:DS-MX':
                        JSON_Data['iva_dsmx'] = parseFloat(amount);
                        JSON_Data['total_dsmx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:IS-MX':
                        JSON_Data['iva_ismx'] = parseFloat(amount);
                        JSON_Data['total_ismx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:IE-MX':
                        JSON_Data['iva_iemx'] = parseFloat(amount);
                        JSON_Data['total_iemx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:Z-MX':
                        JSON_Data['iva_zmx'] = parseFloat(amount);
                        JSON_Data['total_zmx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:E-MX':
                        JSON_Data['iva_emx'] = parseFloat(amount);
                        JSON_Data['total_emx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:SNOC-MX':
                        JSON_Data['iva_snocmx'] = parseFloat(amount);
                        JSON_Data['total_snocmx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:INOC-MX':
                        JSON_Data['iva_inocmx'] = parseFloat(amount);
                        JSON_Data['total_inocmx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:S8-MX':
                        JSON_Data['iva_s8mx'] = parseFloat(amount);
                        JSON_Data['total_s8mx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:S4-MX':
                        JSON_Data['iva_s4mx'] = parseFloat(amount);
                        JSON_Data['total_s4mx'] = parseFloat(amount);
                        break;
                    case 'VAT_MX:S8NOC-MX':
                        JSON_Data['iva_s8nocmx'] = parseFloat(amount);
                        JSON_Data['total_s8nocmx'] = parseFloat(amount);
                        break;
                    default:
                        break;
                }
                //iva_devoluciones = 0;

                var isNotEmpty = false;
                for (var aux in JSON_Data) {
                    if (JSON_Data[aux] != 0) {
                        isNotEmpty = true;
                        break;
                    }
                }
                if (isNotEmpty) {
                    SaveRecordDIOT(recordObj, vendorID, currency, tipocamb, null, null, opeType, JSON_Data, nettotal, taxtotal, grosstotal, savetotal);
                    savetotal = false;
                }

            }
        }

        function CalcularDIOTPayment(recordObj) {

            // Sub-lista de Gastos
            var lineNum = recordObj.getLineCount({
                sublistId: 'apply'
            });
            for (var ind = 0; ind < lineNum; ind++) {

                var apply = recordObj.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: ind
                });

                if (apply == 'T' || apply == true) {
                    var TransactionID = recordObj.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'internalid',
                        line: ind
                    });

                    var typeLine = recordObj.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'trantype',
                        line: ind
                    });

                    var total = recordObj.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'total',
                        line: ind
                    });

                    var amount = recordObj.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'amount',
                        line: ind
                    });

                    /*Calculo de los Bill Credit Aplicados*/
                    var suma = 0;

                    var busqueda = search.create({
                        type: 'vendorcredit',
                        columns: ['internalid', 'appliedtoforeignamount'],
                        filters: [
                            ["mainline", "is", "T"],
                            "AND",
                            ["voided", "is", "F"],
                            "AND",
                            ["posting", "is", "T"],
                            "AND",
                            ["appliedtoforeignamount", "greaterthan", "0.00"],
                            "AND",
                            ["appliedtotransaction.internalid", "anyof", TransactionID]
                        ]
                    });
                    busqueda = busqueda.run().getRange(0, 1000);
                    if (busqueda != null && busqueda != '') {
                        for (var i = 0; i < busqueda.length; i++) {
                            suma += Math.abs(parseFloat(busqueda[i].getValue('appliedtoforeignamount')));
                        }
                    }

                    var coef = amount / (total - suma);
                    if (typeLine == 'ExpRept') {
                        SaveDIOTPaymentExpense(recordObj, TransactionID);
                    }
                    else {
                        SaveDIOTPayment(recordObj, TransactionID, coef);
                    }
                }
            }
            if (IDOmitidos.length > 0) {
                var mensajeOmitido = '';
                mensajeOmitido += 'En el pago con ID:' + recordObj.id;
                mensajeOmitido += ' las transacciones con ID:<br>';
                for (var i = 0; i < IDOmitidos.length; i++) {
                    mensajeOmitido += '- ' + IDOmitidos[i] + '<br>';
                }
                mensajeOmitido += ' no pasaron por el proceso de DIOT, por lo que no se proces&oacute; el pago de esas facturas para el reporte de DIOT';
                library.sendrptuser(mensajeOmitido, 3, 'Importante:');
            }
        }

        function SaveDIOTPayment(recordObj, TransactionID, coef) {
            var recordresult;
            var filtersRd = new Array();
            filtersRd[0] = search.createFilter({
                name: 'custrecord_lmry_mx_transaction_related',
                operator: search.Operator.IS,
                values: recordObj.id
            });
            filtersRd[1] = search.createFilter({
                name: 'custrecord_lmry_mx_paid_transaction',
                operator: search.Operator.IS,
                values: TransactionID
            });
            var recordsearch = search.create({
                type: 'customrecord_lmry_mx_transaction_fields',
                columns: ['internalid', 'custrecord_lmry_mx_transaction_related', 'custrecord_lmry_mx_entity_related',
                    'custrecord_lmry_mx_currency', 'custrecord_lmry_mx_exchange_rate', 'custrecord_lmry_mx_operation_type',
                    'custrecord_lmry_mx_diot_iva_smx', 'custrecord_lmry_mx_diot_iva_dsmx', 'custrecord_lmry_mx_diot_iva_ismx',
                    'custrecord_lmry_mx_diot_iva_iemx', 'custrecord_lmry_mx_diot_iva_zmx', 'custrecord_lmry_mx_diot_iva_emx',
                    'custrecord_lmry_mx_diot_iva_snocmx', 'custrecord_lmry_mx_diot_iva_inocmx', 'custrecord_lmry_mx_diot_iva_s8mx',
                    'custrecord_lmry_mx_diot_iva_s4mx', 'custrecord_lmry_mx_diot_iva_s8nocmx',
                    'custrecord_lmry_mx_diot_total_smx', 'custrecord_lmry_mx_diot_total_dsmx', 'custrecord_lmry_mx_diot_total_ismx',
                    'custrecord_lmry_mx_diot_total_iemx', 'custrecord_lmry_mx_diot_total_zmx', 'custrecord_lmry_mx_diot_total_emx',
                    'custrecord_lmry_mx_diot_total_snocmx', 'custrecord_lmry_mx_diot_total_inocmx', 'custrecord_lmry_mx_diot_total_s8mx',
                    'custrecord_lmry_mx_diot_total_s4mx', 'custrecord_lmry_mx_diot_total_s8nocmx',
                    'custrecord_lmry_mx_diot_ret_smx', 'custrecord_lmry_mx_diot_ret_dsmx', 'custrecord_lmry_mx_diot_ret_ismx',
                    'custrecord_lmry_mx_diot_ret_iemx', 'custrecord_lmry_mx_diot_ret_zmx', 'custrecord_lmry_mx_diot_ret_emx',
                    'custrecord_lmry_mx_diot_ret_snocmx', 'custrecord_lmry_mx_diot_ret_inocmx', 'custrecord_lmry_mx_diot_ret_s8mx',
                    'custrecord_lmry_mx_diot_ret_s4mx', 'custrecord_lmry_mx_diot_ret_s8nocmx', 'custrecord_lmry_mx_diot_iva_devoluciones', 'custrecord_lmry_mx_diot_ret_iva_total'],
                filters: filtersRd
            });
            recordresult = recordsearch.run().getRange(0, 1000);
            var recordsave, recordid;
            if (recordresult != null && recordresult != '') {
                var columns = recordresult[0].columns;

                recordid = recordresult[0].getValue(columns[0]);

            }
            else {
                var filtersRd = new Array();
                filtersRd[0] = search.createFilter({
                    name: 'custrecord_lmry_mx_transaction_related',
                    operator: search.Operator.IS,
                    values: TransactionID
                });
                var recordsearch = search.create({
                    type: 'customrecord_lmry_mx_transaction_fields',
                    columns: ['internalid', 'custrecord_lmry_mx_transaction_related', 'custrecord_lmry_mx_entity_related',
                        'custrecord_lmry_mx_currency', 'custrecord_lmry_mx_exchange_rate', 'custrecord_lmry_mx_operation_type',
                        'custrecord_lmry_mx_diot_iva_smx', 'custrecord_lmry_mx_diot_iva_dsmx', 'custrecord_lmry_mx_diot_iva_ismx',
                        'custrecord_lmry_mx_diot_iva_iemx', 'custrecord_lmry_mx_diot_iva_zmx', 'custrecord_lmry_mx_diot_iva_emx',
                        'custrecord_lmry_mx_diot_iva_snocmx', 'custrecord_lmry_mx_diot_iva_inocmx', 'custrecord_lmry_mx_diot_iva_s8mx',
                        'custrecord_lmry_mx_diot_iva_s4mx', 'custrecord_lmry_mx_diot_iva_s8nocmx',
                        'custrecord_lmry_mx_diot_total_smx', 'custrecord_lmry_mx_diot_total_dsmx', 'custrecord_lmry_mx_diot_total_ismx',
                        'custrecord_lmry_mx_diot_total_iemx', 'custrecord_lmry_mx_diot_total_zmx', 'custrecord_lmry_mx_diot_total_emx',
                        'custrecord_lmry_mx_diot_total_snocmx', 'custrecord_lmry_mx_diot_total_inocmx', 'custrecord_lmry_mx_diot_total_s8mx',
                        'custrecord_lmry_mx_diot_total_s4mx', 'custrecord_lmry_mx_diot_total_s8nocmx',
                        'custrecord_lmry_mx_diot_ret_smx', 'custrecord_lmry_mx_diot_ret_dsmx', 'custrecord_lmry_mx_diot_ret_ismx',
                        'custrecord_lmry_mx_diot_ret_iemx', 'custrecord_lmry_mx_diot_ret_zmx', 'custrecord_lmry_mx_diot_ret_emx',
                        'custrecord_lmry_mx_diot_ret_snocmx', 'custrecord_lmry_mx_diot_ret_inocmx', 'custrecord_lmry_mx_diot_ret_s8mx',
                        'custrecord_lmry_mx_diot_ret_s4mx', 'custrecord_lmry_mx_diot_ret_s8nocmx', 'custrecord_lmry_mx_diot_iva_devoluciones', 'custrecord_lmry_mx_diot_ret_iva_total'],
                    filters: filtersRd
                });
                recordresult = recordsearch.run().getRange(0, 10);

                if (recordresult != null && recordresult != '') {
                    var columns = recordresult[0].columns;
                    recordid = recordresult[0].getValue(columns[0]);
                }
                else {
                    IDOmitidos.push(TransactionID);
                    return true;
                }
            }

            var tranAux = recordresult[0].getValue(columns[1]);
            var vendorID = recordresult[0].getValue(columns[2]);
            var currency = recordObj.getValue({ fieldId: 'currency' });//recordresult[0].getValue(columns[3]);
            var tipocamb = recordObj.getValue({ fieldId: 'exchangerate' });//recordresult[0].getValue(columns[4]);
            var opeType = recordresult[0].getValue(columns[5]);
            JSON_Data['iva_smx'] = recordresult[0].getValue(columns[6]) * coef;
            JSON_Data['iva_dsmx'] = recordresult[0].getValue(columns[7]) * coef;
            JSON_Data['iva_ismx'] = recordresult[0].getValue(columns[8]) * coef;
            JSON_Data['iva_iemx'] = recordresult[0].getValue(columns[9]) * coef;
            JSON_Data['iva_zmx'] = recordresult[0].getValue(columns[10]) * coef;
            JSON_Data['iva_emx'] = recordresult[0].getValue(columns[11]) * coef;
            JSON_Data['iva_snocmx'] = recordresult[0].getValue(columns[12]) * coef;
            JSON_Data['iva_inocmx'] = recordresult[0].getValue(columns[13]) * coef;
            JSON_Data['iva_s8mx'] = recordresult[0].getValue(columns[14]) * coef;
            JSON_Data['iva_s4mx'] = recordresult[0].getValue(columns[15]) * coef;
            JSON_Data['iva_s8nocmx'] = recordresult[0].getValue(columns[16]) * coef;

            JSON_Data['total_smx'] = recordresult[0].getValue(columns[17]) * coef;
            JSON_Data['total_dsmx'] = recordresult[0].getValue(columns[18]) * coef;
            JSON_Data['total_ismx'] = recordresult[0].getValue(columns[19]) * coef;
            JSON_Data['total_iemx'] = recordresult[0].getValue(columns[20]) * coef;
            JSON_Data['total_zmx'] = recordresult[0].getValue(columns[21]) * coef;
            JSON_Data['total_emx'] = recordresult[0].getValue(columns[22]) * coef;
            JSON_Data['total_snocmx'] = recordresult[0].getValue(columns[23]) * coef;
            JSON_Data['total_inocmx'] = recordresult[0].getValue(columns[24]) * coef;
            JSON_Data['total_s8mx'] = recordresult[0].getValue(columns[25]) * coef;
            JSON_Data['total_s4mx'] = recordresult[0].getValue(columns[26]) * coef;
            JSON_Data['total_s8nocmx'] = recordresult[0].getValue(columns[27]) * coef;

            JSON_Data['ret_smx'] = recordresult[0].getValue(columns[28]) * coef;
            JSON_Data['ret_dsmx'] = recordresult[0].getValue(columns[29]) * coef;
            JSON_Data['ret_ismx'] = recordresult[0].getValue(columns[30]) * coef;
            JSON_Data['ret_iemx'] = recordresult[0].getValue(columns[31]) * coef;
            JSON_Data['ret_zmx'] = recordresult[0].getValue(columns[32]) * coef;
            JSON_Data['ret_emx'] = recordresult[0].getValue(columns[33]) * coef;
            JSON_Data['ret_snocmx'] = recordresult[0].getValue(columns[34]) * coef;
            JSON_Data['ret_inocmx'] = recordresult[0].getValue(columns[35]) * coef;
            JSON_Data['ret_s8mx'] = recordresult[0].getValue(columns[36]) * coef;
            JSON_Data['ret_s4mx'] = recordresult[0].getValue(columns[37]) * coef;
            JSON_Data['ret_s8nocmx'] = recordresult[0].getValue(columns[38]) * coef;
            JSON_Data['ret_total_iva'] = recordresult[0].getValue(columns[40]) * coef

            JSON_Data['devoluciones'] = 0;

            var isNotEmpty = false;
            for (var aux in JSON_Data) {
                if (JSON_Data[aux] != 0) {
                    isNotEmpty = true;
                    break;
                }
            }
            if (isNotEmpty) {
                SaveRecordDIOT(recordObj, vendorID, currency, tipocamb, recordid, tranAux, opeType, JSON_Data);
            }

        }

        function SaveDIOTPaymentExpense(recordObj, TransactionID) {
            var filtersRd = new Array();
            filtersRd[0] = search.createFilter({
                name: 'custrecord_lmry_mx_transaction_related',
                operator: search.Operator.IS,
                values: TransactionID
            });
            var recordsearch = search.create({
                type: 'customrecord_lmry_mx_transaction_fields',
                columns: ['internalid', 'custrecord_lmry_mx_transaction_related', 'custrecord_lmry_mx_entity_related',
                    'custrecord_lmry_mx_currency', 'custrecord_lmry_mx_exchange_rate', 'custrecord_lmry_mx_operation_type',
                    'custrecord_lmry_mx_diot_iva_smx', 'custrecord_lmry_mx_diot_iva_dsmx', 'custrecord_lmry_mx_diot_iva_ismx',
                    'custrecord_lmry_mx_diot_iva_iemx', 'custrecord_lmry_mx_diot_iva_zmx', 'custrecord_lmry_mx_diot_iva_emx',
                    'custrecord_lmry_mx_diot_iva_snocmx', 'custrecord_lmry_mx_diot_iva_inocmx', 'custrecord_lmry_mx_diot_iva_s8mx',
                    'custrecord_lmry_mx_diot_iva_s4mx', 'custrecord_lmry_mx_diot_iva_s8nocmx',
                    'custrecord_lmry_mx_diot_total_smx', 'custrecord_lmry_mx_diot_total_dsmx', 'custrecord_lmry_mx_diot_total_ismx',
                    'custrecord_lmry_mx_diot_total_iemx', 'custrecord_lmry_mx_diot_total_zmx', 'custrecord_lmry_mx_diot_total_emx',
                    'custrecord_lmry_mx_diot_total_snocmx', 'custrecord_lmry_mx_diot_total_inocmx', 'custrecord_lmry_mx_diot_total_s8mx',
                    'custrecord_lmry_mx_diot_total_s4mx', 'custrecord_lmry_mx_diot_total_s8nocmx',
                    'custrecord_lmry_mx_diot_ret_smx', 'custrecord_lmry_mx_diot_ret_dsmx', 'custrecord_lmry_mx_diot_ret_ismx',
                    'custrecord_lmry_mx_diot_ret_iemx', 'custrecord_lmry_mx_diot_ret_zmx', 'custrecord_lmry_mx_diot_ret_emx',
                    'custrecord_lmry_mx_diot_ret_snocmx', 'custrecord_lmry_mx_diot_ret_inocmx', 'custrecord_lmry_mx_diot_ret_s8mx',
                    'custrecord_lmry_mx_diot_ret_s4mx', 'custrecord_lmry_mx_diot_ret_s8nocmx', 'custrecord_lmry_mx_diot_iva_devoluciones', 'custrecord_lmry_mx_diot_ret_iva_total'],
                filters: filtersRd
            });
            var recordresult = recordsearch.run().getRange(0, 1000);
            var recordsave, recordid;

            if (recordresult != null && recordresult != '') {
                for (var i = 0; i < recordresult.length; i++) {
                    JSON_Data = {};
                    var columns = recordresult[i].columns;
                    recordid = recordresult[i].getValue(columns[0]);
                    var tranAux = recordresult[i].getValue(columns[1]);
                    var vendorID = recordresult[i].getValue(columns[2]);
                    var currency = recordObj.getValue({ fieldId: 'currency' });//recordresult[0].getValue(columns[3]);
                    var tipocamb = recordObj.getValue({ fieldId: 'exchangerate' });//recordresult[0].getValue(columns[4]);
                    var opeType = recordresult[i].getValue(columns[5]);
                    JSON_Data['iva_smx'] = recordresult[i].getValue(columns[6]);
                    JSON_Data['iva_dsmx'] = recordresult[i].getValue(columns[7]);
                    JSON_Data['iva_ismx'] = recordresult[i].getValue(columns[8]);
                    JSON_Data['iva_iemx'] = recordresult[i].getValue(columns[9]);
                    JSON_Data['iva_zmx'] = recordresult[i].getValue(columns[10]);
                    JSON_Data['iva_emx'] = recordresult[i].getValue(columns[11]);
                    JSON_Data['iva_snocmx'] = recordresult[i].getValue(columns[12]);
                    JSON_Data['iva_inocmx'] = recordresult[i].getValue(columns[13]);
                    JSON_Data['iva_s8mx'] = recordresult[i].getValue(columns[14]);
                    JSON_Data['iva_s4mx'] = recordresult[i].getValue(columns[15]);
                    JSON_Data['iva_s8nocmx'] = recordresult[i].getValue(columns[16]);

                    JSON_Data['total_smx'] = recordresult[i].getValue(columns[17]);
                    JSON_Data['total_dsmx'] = recordresult[i].getValue(columns[18]);
                    JSON_Data['total_ismx'] = recordresult[i].getValue(columns[19]);
                    JSON_Data['total_iemx'] = recordresult[i].getValue(columns[20]);
                    JSON_Data['total_zmx'] = recordresult[i].getValue(columns[21]);
                    JSON_Data['total_emx'] = recordresult[i].getValue(columns[22]);
                    JSON_Data['total_snocmx'] = recordresult[i].getValue(columns[23]);
                    JSON_Data['total_inocmx'] = recordresult[i].getValue(columns[24]);
                    JSON_Data['total_s8mx'] = recordresult[i].getValue(columns[25]);
                    JSON_Data['total_s4mx'] = recordresult[i].getValue(columns[26]);
                    JSON_Data['total_s8nocmx'] = recordresult[i].getValue(columns[27]);

                    JSON_Data['ret_smx'] = recordresult[i].getValue(columns[28]);
                    JSON_Data['ret_dsmx'] = recordresult[i].getValue(columns[29]);
                    JSON_Data['ret_ismx'] = recordresult[i].getValue(columns[30]);
                    JSON_Data['ret_iemx'] = recordresult[i].getValue(columns[31]);
                    JSON_Data['ret_zmx'] = recordresult[i].getValue(columns[32]);
                    JSON_Data['ret_emx'] = recordresult[i].getValue(columns[33]);
                    JSON_Data['ret_snocmx'] = recordresult[i].getValue(columns[34]);
                    JSON_Data['ret_inocmx'] = recordresult[i].getValue(columns[35]);
                    JSON_Data['ret_s8mx'] = recordresult[i].getValue(columns[36]);
                    JSON_Data['ret_s4mx'] = recordresult[i].getValue(columns[37]);
                    JSON_Data['ret_s8nocmx'] = recordresult[i].getValue(columns[38]);
                    JSON_Data['ret_total_iva'] = recordresult[i].getValue(columns[40]);

                    JSON_Data['devoluciones'] = recordresult[i].getValue(columns[39]);

                    var isNotEmpty = false;
                    for (var aux in JSON_Data) {
                        if (JSON_Data[aux] != 0) {
                            isNotEmpty = true;
                            break;
                        }
                    }
                    if (isNotEmpty) {
                        SaveRecordDIOT(recordObj, vendorID, currency, tipocamb, recordid, tranAux, opeType, JSON_Data);
                    }
                }

            } else {
                IDOmitidos.push(TransactionID);
                return true;
            }
        }

        function SaveRecordDIOT(recordObj, entityID, currency, exchangeRate, tranRelated, tranAux, opeType, Json_Aux, netamount, taxamount, grossamount, savecheck) {

            var recordsave;

            var filtersRd = new Array();
            filtersRd[0] = search.createFilter({
                name: 'custrecord_lmry_mx_transaction_related',
                operator: search.Operator.IS,
                values: recordObj.id
            });
            var recordsearch = search.create({
                type: 'customrecord_lmry_mx_transaction_fields',
                columns: ['internalid', 'custrecord_lmry_mx_paid_transaction', 'custrecord_lmry_mx_entity_related'],
                filters: filtersRd
            });
            var recordresult = recordsearch.run().getRange(0, 1000);
            var sw = true;
            if (recordresult != null && recordresult != '') {
                if (recordObj.type == 'vendorpayment') {
                    for (var i = 0; i < recordresult.length; i++) {
                        var columns = recordresult[i].columns;
                        recordid = recordresult[i].getValue(columns[0]);
                        paidTran = recordresult[i].getValue(columns[1]);

                        if (paidTran == tranRelated) {
                            recordsave = record.load({
                                type: 'customrecord_lmry_mx_transaction_fields',
                                id: recordid,
                                isDynamic: true
                            });
                            sw = false;
                            break;
                        }
                    }
                    if (sw) {
                        recordsave = record.create({
                            type: 'customrecord_lmry_mx_transaction_fields',
                            isDynamic: true
                        });
                    }
                }
                else if (recordObj.type == 'expensereport') {
                    recordsave = record.create({
                        type: 'customrecord_lmry_mx_transaction_fields',
                        isDynamic: true
                    });
                }
                else {
                    var columns = recordresult[0].columns;
                    recordid = recordresult[0].getValue(columns[0]);
                    recordsave = record.load({
                        type: 'customrecord_lmry_mx_transaction_fields',
                        id: recordid,
                        isDynamic: true
                    });
                }

            }
            else {
                recordsave = record.create({
                    type: 'customrecord_lmry_mx_transaction_fields',
                    isDynamic: true
                });
            }

            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_transaction_related',
                value: recordObj.id
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_entity_related',
                value: entityID
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_currency',
                value: currency
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_exchange_rate',
                value: exchangeRate
            });
            if (tranRelated != null) {
                recordsave.setValue({
                    fieldId: 'custrecord_lmry_mx_paid_transaction',
                    value: tranRelated
                });
            }
            if (tranAux != null) {
                recordsave.setValue({
                    fieldId: 'custrecord_lmry_mx_transaction',
                    value: tranAux
                });
            }
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_operation_type',
                value: opeType
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_smx',
                value: Json_Aux['iva_smx'] ? Json_Aux['iva_smx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_dsmx',
                value: Json_Aux['iva_dsmx'] ? Json_Aux['iva_dsmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_ismx',
                value: Json_Aux['iva_ismx'] ? Json_Aux['iva_ismx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_iemx',
                value: Json_Aux['iva_iemx'] ? Json_Aux['iva_iemx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_zmx',
                value: Json_Aux['iva_zmx'] ? Json_Aux['iva_zmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_emx',
                value: Json_Aux['iva_emx'] ? Json_Aux['iva_emx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_snocmx',
                value: Json_Aux['iva_snocmx'] ? Json_Aux['iva_snocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_inocmx',
                value: Json_Aux['iva_inocmx'] ? Json_Aux['iva_inocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_s8mx',
                value: Json_Aux['iva_s8mx'] ? Json_Aux['iva_s8mx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_s4mx',
                value: Json_Aux['iva_s4mx'] ? Json_Aux['iva_s4mx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_s8nocmx',
                value: Json_Aux['iva_s8nocmx'] ? Json_Aux['iva_s8nocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_smx',
                value: Json_Aux['total_smx'] ? Json_Aux['total_smx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_dsmx',
                value: Json_Aux['total_dsmx'] ? Json_Aux['total_dsmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_ismx',
                value: Json_Aux['total_ismx'] ? Json_Aux['total_ismx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_iemx',
                value: Json_Aux['total_iemx'] ? Json_Aux['total_iemx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_zmx',
                value: Json_Aux['total_zmx'] ? Json_Aux['total_zmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_emx',
                value: Json_Aux['total_emx'] ? Json_Aux['total_emx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_snocmx',
                value: Json_Aux['total_snocmx'] ? Json_Aux['total_snocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_inocmx',
                value: Json_Aux['total_inocmx'] ? Json_Aux['total_inocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_s8mx',
                value: Json_Aux['total_s8mx'] ? Json_Aux['total_s8mx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_s4mx',
                value: Json_Aux['total_s4mx'] ? Json_Aux['total_s4mx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_s8nocmx',
                value: Json_Aux['total_s8nocmx'] ? Json_Aux['total_s8nocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_smx',
                value: Json_Aux['ret_smx'] ? Json_Aux['ret_smx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_dsmx',
                value: Json_Aux['ret_dsmx'] ? Json_Aux['ret_dsmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_ismx',
                value: Json_Aux['ret_ismx'] ? Json_Aux['ret_ismx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_iemx',
                value: Json_Aux['ret_iemx'] ? Json_Aux['ret_iemx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_zmx',
                value: Json_Aux['ret_zmx'] ? Json_Aux['ret_zmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_emx',
                value: Json_Aux['ret_emx'] ? Json_Aux['ret_emx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_snocmx',
                value: Json_Aux['ret_snocmx'] ? Json_Aux['ret_snocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_inocmx',
                value: Json_Aux['ret_inocmx'] ? Json_Aux['ret_inocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_s8mx',
                value: Json_Aux['ret_s8mx'] ? Json_Aux['ret_s8mx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_s4mx',
                value: Json_Aux['ret_s4mx'] ? Json_Aux['ret_s4mx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_s8nocmx',
                value: Json_Aux['ret_s8nocmx'] ? Json_Aux['ret_s8nocmx'] : 0
            });
            recordsave.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_devoluciones',
                value: Json_Aux['devoluciones'] ? Json_Aux['devoluciones'] : 0
            });

            recordsave.setValue({
                fieldId: "custrecord_lmry_mx_diot_ret_iva_total",
                value: Json_Aux["ret_total_iva"] || 0.00
            });

            if (netamount) {
                recordsave.setValue({
                    fieldId: 'custrecord_lmry_mx_amount_net',
                    value: netamount
                });
            }
            if (taxamount) {
                recordsave.setValue({
                    fieldId: 'custrecord_lmry_mx_amount_tax',
                    value: taxamount
                });
            }
            if (grossamount) {
                recordsave.setValue({
                    fieldId: 'custrecord_lmry_mx_amount_total',
                    value: grossamount
                });
            }
            if (savecheck) {
                recordsave.setValue({
                    fieldId: 'custrecord_lmry_mx_amount_save',
                    value: savecheck
                });
            }
            var saved = recordsave.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
                disableTriggers: true
            });

        }

        function calculatRetTotalIVA(recordObj) {
            var retTotalIvaItems = 0.00, retTotalIvaExpenses = 0.00;
            var whtTaxGroups = getWhtTaxGroups(recordObj);
            log.error("whtTaxGroups", JSON.stringify(whtTaxGroups));
            var configTaxCodes = getConfigWHTTaxCodes(recordObj);
            log.error("configTaxCodes", JSON.stringify(configTaxCodes));
            retTotalIvaItems = calculateRetTotalIVASublists(recordObj, "item", configTaxCodes, whtTaxGroups);
            retTotalIvaExpenses = calculateRetTotalIVASublists(recordObj, "expense", configTaxCodes, whtTaxGroups);

            return retTotalIvaItems + retTotalIvaExpenses;
        }

        function getConfigWHTTaxCodes(recordObj) {
            var configTaxCodes = [];

            var nexus = recordObj.getValue("nexus");

            if (nexus) {
                var searchConfigs = search.create({
                    type: "customrecord_lmry_mx_config_wht_tax_code",
                    filters: [
                        ["isinactive", "is", "F"], "AND",
                        ["custrecord_lmry_mx_conf_taxcode_nexus_id", "equalto", nexus]
                    ],
                    columns: ["internalid", "custrecord_lmry_mx_conf_taxcode_id"]
                });

                var results = searchConfigs.run().getRange(0, 1000);

                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var taxCodeId = results[i].getValue("custrecord_lmry_mx_conf_taxcode_id");
                        if (taxCodeId) {
                            configTaxCodes.push(Number(taxCodeId));
                        }
                    }
                }
            }

            return configTaxCodes;
        }

        function getWhtTaxGroups(recordObj) {
            var whtTaxGroups = {};

            //Se obtiene los WHT Tax Codes seleccionados en las lineas de la transaccion
            var transactionWhtTaxCodes = [];

            var numItems = recordObj.getLineCount({
                sublistId: 'item'
            });

            for (var i = 0; i < numItems; i++) {
                var isWhtApplied = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_4601_witaxapplies', line: i });
                var isWHTLine = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_4601_witaxline', line: i });
                if (!isWHTLine && isWhtApplied) {
                    var lineWHTTaxCode = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_4601_witaxcode', line: i });
                    if (lineWHTTaxCode && transactionWhtTaxCodes.indexOf(Number(lineWHTTaxCode)) == -1) {
                        transactionWhtTaxCodes.push(Number(lineWHTTaxCode));
                    }
                }
            }

            var numExpenses = recordObj.getLineCount({
                sublistId: 'expense'
            });

            for (var i = 0; i < numExpenses; i++) {
                var isWhtApplied = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_4601_witaxapplies', line: i });
                var isWHTLine = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_4601_witaxline', line: i });

                if (!isWHTLine && isWhtApplied) {
                    var lineWHTTaxCode = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'custcol_4601_witaxcode', line: i });
                    if (lineWHTTaxCode && transactionWhtTaxCodes.indexOf(Number(lineWHTTaxCode)) == -1) {
                        transactionWhtTaxCodes.push(Number(lineWHTTaxCode));
                    }
                }
            }

            if (transactionWhtTaxCodes.length) {

                //Se buscan los WHT Tax Codes que sean grupos, que estan asociados al record Grouped Withholding Tax Code
                var searchWHTTaxCodes = search.create({
                    type: "customrecord_4601_groupedwitaxcode",
                    filters:
                        [
                            ["custrecord_4601_gwtc_group", "anyof", transactionWhtTaxCodes], "AND",
                            ["isinactive", "is", "F"], "AND",
                            ["custrecord_4601_gwtc_group.custrecord_4601_wtc_istaxgroup", "is", "T"]
                        ],
                    columns: ["internalid", "custrecord_4601_gwtc_group", "custrecord_4601_gwtc_code", "custrecord_4601_gwtc_basis",
                        search.createColumn({
                            name: "custrecord_4601_wtc_rate",
                            join: "custrecord_4601_gwtc_code",
                        }),
                        search.createColumn({
                            name: "custrecord_4601_wtc_percentageofbase",
                            join: "custrecord_4601_gwtc_code"
                        })
                    ]
                });
                var results = searchWHTTaxCodes.run().getRange(0, 1000);

                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var whtGroupId = results[i].getValue("custrecord_4601_gwtc_group");
                        whtGroupId = String(whtGroupId);
                        var groupedTaxCode = results[i].getValue("custrecord_4601_gwtc_code");
                        groupedTaxCode = String(groupedTaxCode);
                        var taxRate = results[i].getValue({ join: "custrecord_4601_gwtc_code", name: "custrecord_4601_wtc_rate" }) || 0.00;
                        var percentBase = results[i].getValue({ join: "custrecord_4601_gwtc_code", name: "custrecord_4601_wtc_percentageofbase" }) || 0.00;
                        var basis = results[i].getValue("custrecord_4601_gwtc_basis") || 0.00;

                        if (whtGroupId && !whtTaxGroups[whtGroupId]) {
                            whtTaxGroups[whtGroupId] = {}
                        }

                        //Se guardan los valores de los WHT Tax Codes que pertenecen al grupo.
                        if (groupedTaxCode) {
                            whtTaxGroups[whtGroupId][groupedTaxCode] = {
                                basis: parseFloat(basis) / 100,
                                taxRate: parseFloat(taxRate) / 100,
                                percentBase: parseFloat(percentBase) / 100
                            };
                        }
                    }
                }
            }

            return whtTaxGroups;
        }

        function calculateRetTotalIVASublists(recordObj, sublistId, configTaxCodes, whtTaxGroups) {
            var retTotalIva = 0.00;
            var whtTaxes = [];
            if (configTaxCodes.length) {
                var numLines = recordObj.getLineCount({ sublistId: sublistId });

                for (var i = 0; i < numLines; i++) {
                    var isWhtApplied = recordObj.getSublistValue({ sublistId: sublistId, fieldId: 'custcol_4601_witaxapplies', line: i });
                    var isWHTLine = recordObj.getSublistValue({ sublistId: sublistId, fieldId: 'custcol_4601_witaxline', line: i });

                    if (!isWHTLine && isWhtApplied) {
                        var lineWHTTaxCode = recordObj.getSublistValue({ sublistId: sublistId, fieldId: "custcol_4601_witaxcode", line: i });
                        //Si el WHT Tax Code no es un grupo, se toma el monto de retencion de la columna
                        if (!whtTaxGroups[String(lineWHTTaxCode)]) {
                            if (configTaxCodes.indexOf(Number(lineWHTTaxCode)) != -1) {
                                var whtAmount = recordObj.getSublistValue({ sublistId: sublistId, fieldId: "custcol_4601_witaxamount", line: i });
                                whtAmount = Math.abs(parseFloat(whtAmount));
                                if (whtAmount) {
                                    retTotalIva += whtAmount;
                                    whtTaxes.push(lineWHTTaxCode + "-" + whtAmount);
                                }
                            }
                        } else {
                            //Si es WHT Tax Group se calcula la retencion para cada WHT Tax Code que pertenece a este grupo, con los valores obtenidos antes.
                            var whtBaseAmount = recordObj.getSublistValue({ sublistId: sublistId, fieldId: "custcol_4601_witaxbaseamount", line: i });
                            whtBaseAmount = parseFloat(whtBaseAmount);
                            var groupedTaxCodes = whtTaxGroups[String(lineWHTTaxCode)];
                            for (var t in groupedTaxCodes) {
                                if (configTaxCodes.indexOf(Number(t)) != -1) {
                                    var basis = groupedTaxCodes[String(t)]["basis"];
                                    var taxRate = groupedTaxCodes[String(t)]["taxRate"];

                                    var whtAmount = whtBaseAmount * basis * taxRate;
                                    retTotalIva += round2(whtAmount);
                                    whtTaxes.push(t + "-" + whtAmount);
                                }
                            }
                        }

                    }
                }
            }

            log.error("whtTaxes", JSON.stringify(whtTaxes));
            return retTotalIva;
        }

        function round2(amount) {
            return Math.round(parseFloat(amount) * 1e2 + 1e-14) / 1e2;
        }

        function reset(){

          JSON_Data = {};

          diot_iva_smx = 0;
          diot_iva_dsmx = 0;
          diot_iva_ismx = 0;
          diot_iva_iemx = 0;
          diot_iva_zmx = 0;
          diot_iva_emx = 0;
          diot_iva_snocmx = 0;
          diot_iva_inocmx = 0;
          diot_iva_s8mx = 0;
          diot_iva_s8nocmx = 0;
          diot_iva_s4mx = 0;

          diot_total_smx = 0;
          diot_total_dsmx = 0;
          diot_total_ismx = 0;
          diot_total_iemx = 0;
          diot_total_zmx = 0;
          diot_total_emx = 0;
          diot_total_snocmx = 0;
          diot_total_inocmx = 0;
          diot_total_s8mx = 0;
          diot_total_s8nocmx = 0;
          diot_total_s4mx = 0;

          diot_ret_smx = 0;
          diot_ret_dsmx = 0;
          diot_ret_ismx = 0;
          diot_ret_iemx = 0;
          diot_ret_zmx = 0;
          diot_ret_emx = 0;
          diot_ret_snocmx = 0;
          diot_ret_inocmx = 0;
          diot_ret_s8mx = 0;
          diot_ret_s8nocmx = 0;
          diot_ret_s4mx = 0;

          iva_devoluciones = 0;
          IDOmitidos = [];

        }

        return {
            CalculoDIOT: CalculoDIOT
        }
    });
