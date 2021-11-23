/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ST_MX_DIOT_LBRY_V2.0.js                     ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Apl 29 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/record', 'N/runtime', 'N/search', './LMRY_libSendingEmailsLBRY_V2.0'],

    function(record, runtime, search, library) {

        // Nombre del Reporte
        var namereport = 'LatamReady ST MX DIOT LBRY V2.0';
        var LMRY_script = 'LatamReady - ST MX DIOT LBRY V2.0';
        var intMaxMem = 200;
        var scriptObj = runtime.getCurrentScript();

        // Variable para almacenar los Taxes
        var JSON_Data = {};

        // Variables globales de los TaxCodes
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

        // var diot_ret_smx = 0;
        // var diot_ret_dsmx = 0;
        // var diot_ret_ismx = 0;
        // var diot_ret_iemx = 0;
        // var diot_ret_zmx = 0;
        // var diot_ret_emx = 0;
        // var diot_ret_snocmx = 0;
        // var diot_ret_inocmx = 0;
        // var diot_ret_s8mx = 0;
        // var diot_ret_s8nocmx = 0;
        // var diot_ret_s4mx = 0;

        var iva_devoluciones = 0;
        var IDOmitidos = [];

        function calculoDIOT(recordObj) {

            try {

                // Reiniciar las variables globales
                reset();

                if (recordObj.type == 'expensereport') {
                    ExpenseReportDIOT(recordObj);
                } else if (recordObj.type == 'vendorpayment') {
                    CalcularDIOTPayment(recordObj);
                } else if (recordObj.type == 'vendorbill') {

                    CalcularDIOTExpense(recordObj);
                    CalcularDIOTItem(recordObj);

                    var currency = recordObj.getValue({ fieldId: "currency" });
                    var exchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
                    var entityId = recordObj.getValue({ fieldId: "entity" });
                    var operationType = recordObj.getValue({ fieldId: "custbody_lmry_mx_operation_type" });

                    var totalTaxAmount = recordObj.getValue({ fieldId: "taxtotal" });
                    var totalGrossAmount = recordObj.getValue({ fieldId: "total" });
                    var totalNetAmount = parseFloat(totalGrossAmount) - parseFloat(totalTaxAmount);

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

                    // JSON_Data['ret_smx'] = parseFloat(diot_ret_smx).toFixed(2);
                    // JSON_Data['ret_dsmx'] = parseFloat(diot_ret_dsmx).toFixed(2);
                    // JSON_Data['ret_ismx'] = parseFloat(diot_ret_ismx).toFixed(2);
                    // JSON_Data['ret_iemx'] = parseFloat(diot_ret_iemx).toFixed(2);
                    // JSON_Data['ret_zmx'] = parseFloat(diot_ret_zmx).toFixed(2);
                    // JSON_Data['ret_emx'] = parseFloat(diot_ret_emx).toFixed(2);
                    // JSON_Data['ret_snocmx'] = parseFloat(diot_ret_snocmx).toFixed(2);
                    // JSON_Data['ret_inocmx'] = parseFloat(diot_ret_inocmx).toFixed(2);
                    // JSON_Data['ret_s8mx'] = parseFloat(diot_ret_s8mx).toFixed(2);
                    // JSON_Data['ret_s8nocmx'] = parseFloat(diot_ret_s8nocmx).toFixed(2);
                    // JSON_Data['ret_s4mx'] = parseFloat(diot_ret_s4mx).toFixed(2);
                    //
                    // JSON_Data['devoluciones'] = parseFloat(iva_devoluciones).toFixed(2);
                    //
                    // JSON_Data["ret_total_iva"] = round2(retTotalIva);

                    var isNotEmpty = false;
                    for (var aux in JSON_Data) {
                        if (JSON_Data[aux] != 0) {
                            isNotEmpty = true;
                            break;
                        }
                    }

                    if (isNotEmpty) {
                        SaveRecordDIOT(recordObj, entityId, currency, exchangeRate, null, null, operationType, JSON_Data, totalNetAmount, totalTaxAmount, totalGrossAmount, true);
                    }

                } else {

                    var currency = recordObj.getValue({ fieldId: "currency" });
                    var exchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
                    var entityId = recordObj.getValue({ fieldId: "entity" });
                    var operationType = recordObj.getValue({ fieldId: "custbody_lmry_mx_operation_type" });
                    var totalGrossAmount = recordObj.getValue({ fieldId: "total" });
                    var totalTaxAmount = recordObj.getValue({ fieldId: "taxtotal" });
                    var totalNetAmount = totalGrossAmount - totalTaxAmount;
                    var relatedTransaction = recordObj.getValue({ fieldId: "createdfrom" });

                    if (relatedTransaction == "" || relatedTransaction == null) {

                        var applyLineCount = recordObj.getLineCount({ sublistId: "apply" });
                        for (var i = 0; i < applyLineCount; i++) {

                            var isApply = recordObj.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
                            if (isApply === true || isApply === "T")  {
                                relatedTransaction = recordObj.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
                                break;
                            }

                        }

                    }

                    iva_devoluciones = parseFloat(iva_devoluciones) + parseFloat(totalGrossAmount);
                    JSON_Data['devoluciones'] = iva_devoluciones.toFixed(2);

                    SaveRecordDIOT(recordObj, entityId, currency, exchangeRate, null, relatedTransaction, operationType, JSON_Data, totalNetAmount, totalTaxAmount, totalGrossAmount, true);

                }

            } catch (error) {
                library.sendemail('Calculo_DIOT - Error: ' + error, LMRY_script);
            }

            // Fin del proceso
            return true;

        }

        /***********************************************************
         * FUNCION PARA REINICIAR LAS VARIABLES GLOBALES
         ***********************************************************/
        function reset() {

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

            // diot_ret_smx = 0;
            // diot_ret_dsmx = 0;
            // diot_ret_ismx = 0;
            // diot_ret_iemx = 0;
            // diot_ret_zmx = 0;
            // diot_ret_emx = 0;
            // diot_ret_snocmx = 0;
            // diot_ret_inocmx = 0;
            // diot_ret_s8mx = 0;
            // diot_ret_s8nocmx = 0;
            // diot_ret_s4mx = 0;

            iva_devoluciones = 0;
            IDOmitidos = [];

        }

        /*************************************************************************
         * Funcion para recuperar las lineas de los tax details que pertenece
         * al tipo Expense y hacer la cálculos respectivos de acuerdo al
         * tipo de impuesto
         *************************************************************************/
        function CalcularDIOTExpense(recordObj) {

            var exchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
            var expenseLineCount = recordObj.getLineCount({ sublistId: "expense" });
            var taxdetailsLineCount = recordObj.getLineCount({ sublistId: "taxdetails" });

            for (var i = 0; i < taxdetailsLineCount; i++) {

                var TD_LineType = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "linetype", line: i });
                if (TD_LineType === "Expense") {

                    var TD_Reference = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: i });
                    var TD_TaxAmount = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: i });
                    log.error('[TD_TaxAmount]', TD_TaxAmount);
                    for (var j = 0; j < expenseLineCount; j++) {

                        var E_Reference = recordObj.getSublistValue({ sublistId: "expense", fieldId: "taxdetailsreference", line: j });
                        if (TD_Reference === E_Reference) {

                            var expenseNetAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j }) || 0;
                            var expenseGrossAmount = parseFloat(expenseNetAmount + TD_TaxAmount);

                            break;

                        }

                    }

                    var TD_TaxCode = recordObj.getSublistText({ sublistId: "taxdetails", fieldId: "taxcode", line: i });
                    TD_TaxCode = TD_TaxCode.toUpperCase();

                    switch (TD_TaxCode) {

                        case "S-MX":
                            diot_iva_smx = parseFloat(diot_iva_smx) + parseFloat(expenseNetAmount);
                            diot_total_smx = parseFloat(diot_total_smx) + parseFloat(expenseGrossAmount);
                            break;

                        case "DS-MX":
                            diot_iva_dsmx = parseFloat(diot_iva_dsmx) + parseFloat(expenseNetAmount);
                            diot_total_dsmx = parseFloat(diot_total_dsmx) + parseFloat(expenseGrossAmount);
                            break;

                        case "IS-MX":
                            diot_iva_ismx = parseFloat(diot_iva_ismx) + parseFloat(expenseNetAmount);
                            diot_total_ismx = parseFloat(diot_total_ismx) + parseFloat(expenseGrossAmount);
                            break;

                        case "IE-MX":
                            diot_iva_iemx = parseFloat(diot_iva_iemx) + parseFloat(expenseNetAmount);
                            diot_total_iemx = parseFloat(diot_total_iemx) + parseFloat(expenseGrossAmount);
                            break;

                        case "Z-MX":
                            diot_iva_zmx = parseFloat(diot_iva_zmx) + parseFloat(expenseNetAmount);
                            diot_total_zmx = parseFloat(diot_total_zmx) + parseFloat(expenseGrossAmount);
                            break;

                        case "E-MX":
                            diot_iva_emx = parseFloat(diot_iva_emx) + parseFloat(expenseNetAmount);
                            diot_total_emx = parseFloat(diot_total_emx) + parseFloat(expenseGrossAmount);
                            break;

                        case "SNOC-MX":
                            diot_iva_snocmx = parseFloat(diot_iva_snocmx) + parseFloat(expenseNetAmount);
                            diot_total_snocmx = parseFloat(diot_total_snocmx) + parseFloat(expenseGrossAmount);
                            break;

                        case "INOC-MX":
                            diot_iva_inocmx = parseFloat(diot_iva_inocmx) + parseFloat(expenseNetAmount);
                            diot_total_inocmx = parseFloat(diot_total_inocmx) + parseFloat(expenseGrossAmount);
                            break;

                        case "S8-MX":
                            diot_iva_s8mx = parseFloat(diot_iva_s8mx) + parseFloat(expenseNetAmount);
                            diot_total_s8mx = parseFloat(diot_total_s8mx) + parseFloat(expenseGrossAmount);
                            break;

                        case "S4-MX":
                            diot_iva_s4mx = parseFloat(diot_iva_s4mx) + parseFloat(expenseNetAmount);
                            diot_total_s4mx = parseFloat(diot_total_s4mx) + parseFloat(expenseGrossAmount);
                            break;

                        case "S8NOC-MX":
                            diot_iva_s8nocmx = parseFloat(diot_iva_s8nocmx) + parseFloat(expenseNetAmount);
                            diot_total_s8nocmx = parseFloat(diot_total_s8nocmx) + parseFloat(expenseGrossAmount);
                            break;

                        default:
                            break;

                    }

                }

            }

        }

        /*************************************************************************
         * Funcion para recuperar las lineas de los tax details que pertenece
         * al tipo Item y hacer la cálculos respectivos de acuerdo al
         * tipo de impuesto
         *************************************************************************/
        function CalcularDIOTItem(recordObj) {

            var exchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
            var itemLineCount = recordObj.getLineCount({ sublistId: "item" });
            var taxdetailsLineCount = recordObj.getLineCount({ sublistId: "taxdetails" });

            for (var i = 0; i < taxdetailsLineCount; i++) {

                var TD_LineType = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "linetype", line: i });
                if (TD_LineType === "Item") {

                    var TD_Reference = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: i });
                    var TD_TaxAmount = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: i });
                    for (var j = 0; j < itemLineCount; j++) {

                        var I_Reference = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: j });
                        if (TD_Reference === I_Reference) {

                            var itemNetAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j }) || 0;
                            var itemGrossAmount = parseFloat(itemNetAmount + TD_TaxAmount);

                            break;

                        }

                    }

                    var TD_TaxCode = recordObj.getSublistText({ sublistId: "taxdetails", fieldId: "taxcode", line: i });
                    TD_TaxCode = TD_TaxCode.toUpperCase();

                    switch (TD_TaxCode) {

                        case "S-MX":
                            diot_iva_smx = parseFloat(diot_iva_smx) + parseFloat(itemNetAmount);
                            diot_total_smx = parseFloat(diot_total_smx) + parseFloat(itemGrossAmount);
                            break;

                        case "DS-MX":
                            diot_iva_dsmx = parseFloat(diot_iva_dsmx) + parseFloat(itemNetAmount);
                            diot_total_dsmx = parseFloat(diot_total_dsmx) + parseFloat(itemGrossAmount);
                            break;

                        case "IS-MX":
                            diot_iva_ismx = parseFloat(diot_iva_ismx) + parseFloat(itemNetAmount);
                            diot_total_ismx = parseFloat(diot_total_ismx) + parseFloat(itemGrossAmount);
                            break;

                        case "IE-MX":
                            diot_iva_iemx = parseFloat(diot_iva_iemx) + parseFloat(itemNetAmount);
                            diot_total_iemx = parseFloat(diot_total_iemx) + parseFloat(itemGrossAmount);
                            break;

                        case "Z-MX":
                            diot_iva_zmx = parseFloat(diot_iva_zmx) + parseFloat(itemNetAmount);
                            diot_total_zmx = parseFloat(diot_total_zmx) + parseFloat(itemGrossAmount);
                            break;

                        case "E-MX":
                            diot_iva_emx = parseFloat(diot_iva_emx) + parseFloat(itemNetAmount);
                            diot_total_emx = parseFloat(diot_total_emx) + parseFloat(itemGrossAmount);
                            break;

                        case "SNOC-MX":
                            diot_iva_snocmx = parseFloat(diot_iva_snocmx) + parseFloat(itemNetAmount);
                            diot_total_snocmx = parseFloat(diot_total_snocmx) + parseFloat(itemGrossAmount);
                            break;

                        case "INOC-MX":
                            diot_iva_inocmx = parseFloat(diot_iva_inocmx) + parseFloat(itemNetAmount);
                            diot_total_inocmx = parseFloat(diot_total_inocmx) + parseFloat(itemGrossAmount);
                            break;

                        case "S8-MX":
                            diot_iva_s8mx = parseFloat(diot_iva_s8mx) + parseFloat(itemNetAmount);
                            diot_total_s8mx = parseFloat(diot_total_s8mx) + parseFloat(itemGrossAmount);
                            break;

                        case "S4-MX":
                            diot_iva_s4mx = parseFloat(diot_iva_s4mx) + parseFloat(itemNetAmount);
                            diot_total_s4mx = parseFloat(diot_total_s4mx) + parseFloat(itemGrossAmount);
                            break;

                        case "S8NOC-MX":
                            diot_iva_s8nocmx = parseFloat(diot_iva_s8nocmx) + parseFloat(itemNetAmount);
                            diot_total_s8nocmx = parseFloat(diot_total_s8nocmx) + parseFloat(itemGrossAmount);
                            break;

                        default:
                            break;

                    }

                }

            }

        }

        /*************************************************************************
         * Funcion para recuperar las lineas de los tax details para hacer
         * los respectivos cálculo por línea de expense y por Vendor (Expense Report)
         *************************************************************************/
        function ExpenseReportDIOT(recordObj) {

            var MX_TF_Search = search.create({
                type: "customrecord_lmry_mx_transaction_fields",
                columns: ["internalid"],
                filters: [
                    ["custrecord_lmry_mx_transaction", "IS", recordObj.id]
                ]
            }).run().getRange(0, 1000);
            var recordid = 0;

            if (MX_TF_Search != null || MX_TF_Search != "") {
                for (var i = 0; i < MX_TF_Search.length; i++) {
                    recordid = MX_TF_Search[i].getValue({ name: "internalid" });
                    record.delete({ type: "customrecord_lmry_mx_transaction_fields", id: recordid });
                }
            }

            MX_TF_Search = search.create({
                type: "customrecord_lmry_mx_transaction_fields",
                columns: ["internalid"],
                filters: [
                    ["custrecord_lmry_mx_transaction_related", "IS", recordObj.id]
                ]
            }).run().getRange(0, 1000);

            if (MX_TF_Search != null || MX_TF_Search != "") {
                for (var i = 0; i < MX_TF_Search.length; i++) {
                    recordid = MX_TF_Search[i].getValue({ name: "internalid" });
                    record.delete({ type: "customrecord_lmry_mx_transaction_fields", id: recordid });
                }
            }

            var operationType = recordObj.getValue({ fieldId: "custbody_lmry_mx_operation_type" });
            var expenseLineCount = recordObj.getLineCount({ sublistId: "expense" });
            var taxLineCount = recordObj.getLineCount({ sublistId: "taxdetails" });
            var exchangeRate = recordObj.getValue({ fieldId: "expensereportexchangerate" });
            var expenseCurrency = recordObj.getValue({ fieldId: "expensereportcurrency" });

            var netAmountTotal = recordObj.getValue({ fieldId: "expense_total" });
            var taxAmountTotal = recordObj.getValue({ fieldId: "taxtotal" });
            var grossAmountTotal = recordObj.getValue({ fieldId: "total" });

            netAmountTotal = netAmountTotal ? netAmountTotal : grossAmountTotal - taxAmountTotal;

            var saveTotal = true;
            for (var i = 0; i < expenseLineCount; i++) {

                var expenseLineReference = recordObj.getSublistValue({ sublistId: "expense", fieldId: "taxdetailsreference", line: i });
                var vendorId = recordObj.getSublistValue({ sublistId: "expense", fieldId: "custcol_lmry_exp_rep_vendor_colum", line: i });
                var netAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "amount", line: i });
                // REINICIAR VALORES
                JSON_Data = {};

                if (expenseLineReference) {

                    var taxCode = "";
                    for (var j = 0; j < taxLineCount; j++) {
                        var taxLineReference = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: j });
                        if (expenseLineReference == taxLineReference) {

                            taxCode = recordObj.getSublistText({ sublistId: "taxdetails", fieldId: "taxcode", line: j });
                            taxCode = taxCode.toUpperCase();
                            break;

                        }
                    }

                    switch (taxCode) {
                        case 'S-MX':
                            JSON_Data['iva_smx'] = parseFloat(netAmount);
                            JSON_Data['total_smx'] = parseFloat(netAmount);
                            break;

                        case 'DS-MX':
                            JSON_Data['iva_dsmx'] = parseFloat(netAmount);
                            JSON_Data['total_dsmx'] = parseFloat(netAmount);
                            break;

                        case 'IS-MX':
                            JSON_Data['iva_ismx'] = parseFloat(netAmount);
                            JSON_Data['total_ismx'] = parseFloat(netAmount);
                            break;

                        case 'IE-MX':
                            JSON_Data['iva_iemx'] = parseFloat(netAmount);
                            JSON_Data['total_iemx'] = parseFloat(netAmount);
                            break;

                        case 'Z-MX':
                            JSON_Data['iva_zmx'] = parseFloat(netAmount);
                            JSON_Data['total_zmx'] = parseFloat(netAmount);
                            break;

                        case 'E-MX':
                            JSON_Data['iva_emx'] = parseFloat(netAmount);
                            JSON_Data['total_emx'] = parseFloat(netAmount);
                            break;

                        case 'SNOC-MX':
                            JSON_Data['iva_snocmx'] = parseFloat(netAmount);
                            JSON_Data['total_snocmx'] = parseFloat(netAmount);
                            break;

                        case 'INOC-MX':
                            JSON_Data['iva_inocmx'] = parseFloat(netAmount);
                            JSON_Data['total_inocmx'] = parseFloat(netAmount);
                            break;

                        case 'S8-MX':
                            JSON_Data['iva_s8mx'] = parseFloat(netAmount);
                            JSON_Data['total_s8mx'] = parseFloat(netAmount);
                            break;

                        case 'S4-MX':
                            JSON_Data['iva_s4mx'] = parseFloat(netAmount);
                            JSON_Data['total_s4mx'] = parseFloat(netAmount);
                            break;

                        case 'S8NOC-MX':
                            JSON_Data['iva_s8nocmx'] = parseFloat(netAmount);
                            JSON_Data['total_s8nocmx'] = parseFloat(netAmount);
                            break;

                        default:
                            break;
                    }

                    var isNotEmpty = false;
                    for (var aux in JSON_Data) {
                        if (JSON_Data[aux] != 0) {
                            isNotEmpty = true;
                            break;
                        }
                    }

                    if (isNotEmpty) {
                        SaveRecordDIOT(recordObj, vendorId, expenseCurrency, exchangeRate, null, null, operationType, JSON_Data, netAmountTotal, taxAmountTotal, grossAmountTotal, saveTotal);
                        saveTotal = false;
                    }

                }

            }

        }

        /*************************************************************************
         * Funcion para recuperar las lineas de los tax details para hacer
         * los respectivos cálculo por línea de expense y por Vendor (Vendor Payment)
         *************************************************************************/
        function CalcularDIOTPayment(recordObj) {

            var applyLineCount = recordObj.getLineCount({ sublistId: "apply" });
            for (var i = 0; i < applyLineCount; i++) {

                var isApply = recordObj.getSublistValue({ sublistId: "apply", fieldId: "apply", line: i });
                if (isApply === true || isApply === "T") {

                    var TransactionID = recordObj.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
                    var TransactionType = recordObj.getSublistValue({ sublistId: "apply", fieldId: "trantype", line: i });
                    var TransactionTotal = recordObj.getSublistValue({ sublistId: "apply", fieldId: "total", line: i });
                    var TransactionAmount = recordObj.getSublistValue({ sublistId: "apply", fieldId: "amount", line: i });

                    // CÁLCULO DE LOS BILL CREDIT APLICADOS
                    var suma = 0;
                    var VendorCredit_Search = search.create({
                        type: "vendorcredit",
                        columns: ["internalid", "appliedtoforeignamount"],
                        filters: [
                            ["mainline", "is", "T"],
                            "AND", ["voided", "is", "F"],
                            "AND", ["posting", "is", "T"],
                            "AND", ["appliedtoforeignamount", "greaterthan", "0.00"],
                            "AND", ["appliedtotransaction.internalid", "anyof", TransactionID]
                        ]
                    }).run().getRange(0, 1000);

                    if (VendorCredit_Search != null && VendorCredit_Search != "") {
                        for (var j = 0; j < VendorCredit_Search.length; j++) {
                            suma += Math.abs(parseFloat(VendorCredit_Search[j].getValue({ name: "appliedtoforeignamount" })));
                        }
                    }

                    var coef = TransactionAmount / (TransactionTotal - suma);
                    if (TransactionType === "ExpRept") {
                        SaveDIOTPaymentExpense(recordObj, TransactionID);
                    } else {
                        SaveDIOTPayment(recordObj, TransactionID, coef);
                    }

                }

            }

            if (IDOmitidos.length > 0) {
                var mensajeOmitido = "";
                mensajeOmitido += "En el pago con ID: " + recordObj.id;
                mensajeOmitido += " las transaccion con ID: <br>";
                for (var k = 0; k < IDOmitidos.length; k++) {
                    mensajeOmitido += "- " + IDOmitidos[k] + "<br>";
                }
                mensajeOmitido += " no pasaron por el proceso de DIOT, por lo que no se proces&oacute; el pago de esas facturas para el reporte de DIOT";
                library.sendrptuser(mensajeOmitido, 3, "Importante: ");
            }

        }

        function SaveDIOTPayment(recordObj, TransactionID, coef) {

            var MX_TF_Columns = ['internalid', 'custrecord_lmry_mx_transaction_related', 'custrecord_lmry_mx_entity_related',
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
                'custrecord_lmry_mx_diot_ret_s4mx', 'custrecord_lmry_mx_diot_ret_s8nocmx', 'custrecord_lmry_mx_diot_iva_devoluciones',
                'custrecord_lmry_mx_diot_ret_iva_total'
            ]

            var MX_TF_Search = search.create({
                type: "customrecord_lmry_mx_transaction_fields",
                columns: MX_TF_Columns,
                filters: [
                    ["custrecord_lmry_mx_transaction_related", "IS", recordObj.id],
                    "AND", ["custrecord_lmry_mx_paid_transaction", "IS", TransactionID]
                ]
            }).run().getRange(0, 1000);

            var recordSave;
            var recordId;

            if (MX_TF_Search != null && MX_TF_Search != "") {

                var columns = MX_TF_Search[0].columns;
                recordId = MX_TF_Search[0].getValue(columns[0]);

            } else {

                var MX_TF_Search = search.create({
                    type: "customrecord_lmry_mx_transaction_fields",
                    columns: MX_TF_Columns,
                    filters: [
                        ["custrecord_lmry_mx_transaction_related", "IS", TransactionID]
                    ]
                }).run().getRange(0, 1000);

                if (MX_TF_Search != null && MX_TF_Search != "") {

                    var columns = MX_TF_Search[0].columns;
                    recordId = MX_TF_Search[0].getValue(columns[0]);

                } else {

                    IDOmitidos.push(TransactionID);
                    return true;

                }

            }

            var currency = recordObj.getValue({ fieldId: "currency" });
            var exchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
            var relatedTransaction = MX_TF_Search[0].getValue(columns[1]);
            var vendorId = MX_TF_Search[0].getValue(columns[2]);
            var operationType = MX_TF_Search[0].getValue(columns[5]);

            JSON_Data['iva_smx'] = MX_TF_Search[0].getValue(columns[6]) * coef;
            JSON_Data['iva_dsmx'] = MX_TF_Search[0].getValue(columns[7]) * coef;
            JSON_Data['iva_ismx'] = MX_TF_Search[0].getValue(columns[8]) * coef;
            JSON_Data['iva_iemx'] = MX_TF_Search[0].getValue(columns[9]) * coef;
            JSON_Data['iva_zmx'] = MX_TF_Search[0].getValue(columns[10]) * coef;
            JSON_Data['iva_emx'] = MX_TF_Search[0].getValue(columns[11]) * coef;
            JSON_Data['iva_snocmx'] = MX_TF_Search[0].getValue(columns[12]) * coef;
            JSON_Data['iva_inocmx'] = MX_TF_Search[0].getValue(columns[13]) * coef;
            JSON_Data['iva_s8mx'] = MX_TF_Search[0].getValue(columns[14]) * coef;
            JSON_Data['iva_s4mx'] = MX_TF_Search[0].getValue(columns[15]) * coef;
            JSON_Data['iva_s8nocmx'] = MX_TF_Search[0].getValue(columns[16]) * coef;

            JSON_Data['total_smx'] = MX_TF_Search[0].getValue(columns[17]) * coef;
            JSON_Data['total_dsmx'] = MX_TF_Search[0].getValue(columns[18]) * coef;
            JSON_Data['total_ismx'] = MX_TF_Search[0].getValue(columns[19]) * coef;
            JSON_Data['total_iemx'] = MX_TF_Search[0].getValue(columns[20]) * coef;
            JSON_Data['total_zmx'] = MX_TF_Search[0].getValue(columns[21]) * coef;
            JSON_Data['total_emx'] = MX_TF_Search[0].getValue(columns[22]) * coef;
            JSON_Data['total_snocmx'] = MX_TF_Search[0].getValue(columns[23]) * coef;
            JSON_Data['total_inocmx'] = MX_TF_Search[0].getValue(columns[24]) * coef;
            JSON_Data['total_s8mx'] = MX_TF_Search[0].getValue(columns[25]) * coef;
            JSON_Data['total_s4mx'] = MX_TF_Search[0].getValue(columns[26]) * coef;
            JSON_Data['total_s8nocmx'] = MX_TF_Search[0].getValue(columns[27]) * coef;

            // JSON_Data['ret_smx'] = MX_TF_Search[0].getValue(columns[28]) * coef;
            // JSON_Data['ret_dsmx'] = MX_TF_Search[0].getValue(columns[29]) * coef;
            // JSON_Data['ret_ismx'] = MX_TF_Search[0].getValue(columns[30]) * coef;
            // JSON_Data['ret_iemx'] = MX_TF_Search[0].getValue(columns[31]) * coef;
            // JSON_Data['ret_zmx'] = MX_TF_Search[0].getValue(columns[32]) * coef;
            // JSON_Data['ret_emx'] = MX_TF_Search[0].getValue(columns[33]) * coef;
            // JSON_Data['ret_snocmx'] = MX_TF_Search[0].getValue(columns[34]) * coef;
            // JSON_Data['ret_inocmx'] = MX_TF_Search[0].getValue(columns[35]) * coef;
            // JSON_Data['ret_s8mx'] = MX_TF_Search[0].getValue(columns[36]) * coef;
            // JSON_Data['ret_s4mx'] = MX_TF_Search[0].getValue(columns[37]) * coef;
            // JSON_Data['ret_s8nocmx'] = MX_TF_Search[0].getValue(columns[38]) * coef;
            // JSON_Data['ret_total_iva'] = MX_TF_Search[0].getValue(columns[40]) * coef;

            JSON_Data['devoluciones'] = 0;

            var isNotEmpty = false;
            for (var aux in JSON_Data) {
                if (JSON_Data[aux] != 0) {
                    isNotEmpty = true;
                    break;
                }
            }

            if (isNotEmpty) {
                SaveRecordDIOT(recordObj, vendorId, currency, exchangeRate, recordId, relatedTransaction, operationType, JSON_Data);
            }

        }

        function SaveDIOTPaymentExpense(recordObj, TransactionID) {

            var MX_TF_Search = search.create({
                type: "customrecord_lmry_mx_transaction_fields",
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
                    'custrecord_lmry_mx_diot_ret_s4mx', 'custrecord_lmry_mx_diot_ret_s8nocmx', 'custrecord_lmry_mx_diot_iva_devoluciones',
                    'custrecord_lmry_mx_diot_ret_iva_total'
                ],
                filters: [
                    ["custrecord_lmry_mx_transaction_related", "IS", TransactionID]
                ]
            }).run().getRange(0, 1000);

            var recordId;
            if (MX_TF_Search != null ||  MX_TF_Search != "") {

                for (var i = 0; i < MX_TF_Search.length; i++) {

                    JSON_Data = {};

                    var columns = MX_TF_Search[i].columns;

                    recordId = MX_TF_Search[i].getValue(columns[0]);
                    var relatedTransaction = MX_TF_Search[i].getValue(columns[1]);
                    var vendorId = MX_TF_Search[i].getValue(columns[2]);
                    var currency = recordObj.getValue({ fieldId: "currency" });
                    var exchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
                    var operationType = MX_TF_Search[i].getValue(columns[5]);

                    JSON_Data['iva_smx'] = MX_TF_Search[i].getValue(columns[6]);
                    JSON_Data['iva_dsmx'] = MX_TF_Search[i].getValue(columns[7]);
                    JSON_Data['iva_ismx'] = MX_TF_Search[i].getValue(columns[8]);
                    JSON_Data['iva_iemx'] = MX_TF_Search[i].getValue(columns[9]);
                    JSON_Data['iva_zmx'] = MX_TF_Search[i].getValue(columns[10]);
                    JSON_Data['iva_emx'] = MX_TF_Search[i].getValue(columns[11]);
                    JSON_Data['iva_snocmx'] = MX_TF_Search[i].getValue(columns[12]);
                    JSON_Data['iva_inocmx'] = MX_TF_Search[i].getValue(columns[13]);
                    JSON_Data['iva_s8mx'] = MX_TF_Search[i].getValue(columns[14]);
                    JSON_Data['iva_s4mx'] = MX_TF_Search[i].getValue(columns[15]);
                    JSON_Data['iva_s8nocmx'] = MX_TF_Search[i].getValue(columns[16]);

                    JSON_Data['total_smx'] = MX_TF_Search[i].getValue(columns[17]);
                    JSON_Data['total_dsmx'] = MX_TF_Search[i].getValue(columns[18]);
                    JSON_Data['total_ismx'] = MX_TF_Search[i].getValue(columns[19]);
                    JSON_Data['total_iemx'] = MX_TF_Search[i].getValue(columns[20]);
                    JSON_Data['total_zmx'] = MX_TF_Search[i].getValue(columns[21]);
                    JSON_Data['total_emx'] = MX_TF_Search[i].getValue(columns[22]);
                    JSON_Data['total_snocmx'] = MX_TF_Search[i].getValue(columns[23]);
                    JSON_Data['total_inocmx'] = MX_TF_Search[i].getValue(columns[24]);
                    JSON_Data['total_s8mx'] = MX_TF_Search[i].getValue(columns[25]);
                    JSON_Data['total_s4mx'] = MX_TF_Search[i].getValue(columns[26]);
                    JSON_Data['total_s8nocmx'] = MX_TF_Search[i].getValue(columns[27]);

                    // JSON_Data['ret_smx'] = MX_TF_Search[i].getValue(columns[28]);
                    // JSON_Data['ret_dsmx'] = MX_TF_Search[i].getValue(columns[29]);
                    // JSON_Data['ret_ismx'] = MX_TF_Search[i].getValue(columns[30]);
                    // JSON_Data['ret_iemx'] = MX_TF_Search[i].getValue(columns[31]);
                    // JSON_Data['ret_zmx'] = MX_TF_Search[i].getValue(columns[32]);
                    // JSON_Data['ret_emx'] = MX_TF_Search[i].getValue(columns[33]);
                    // JSON_Data['ret_snocmx'] = MX_TF_Search[i].getValue(columns[34]);
                    // JSON_Data['ret_inocmx'] = MX_TF_Search[i].getValue(columns[35]);
                    // JSON_Data['ret_s8mx'] = MX_TF_Search[i].getValue(columns[36]);
                    // JSON_Data['ret_s4mx'] = MX_TF_Search[i].getValue(columns[37]);
                    // JSON_Data['ret_s8nocmx'] = MX_TF_Search[i].getValue(columns[38]);
                    // JSON_Data['ret_total_iva'] = MX_TF_Search[i].getValue(columns[40]);

                    JSON_Data['devoluciones'] = MX_TF_Search[i].getValue(columns[39]);

                    var isNotEmpty = false;
                    for (var aux in JSON_Data) {
                        if (JSON_Data[aux] != 0) {
                            isNotEmpty = true;
                            break;
                        }
                    }

                    if (isNotEmpty) {
                        SaveRecordDIOT(recordObj, vendorId, currency, exchangeRate, recordId, relatedTransaction, operationType, JSON_Data);
                    }

                }

            } else {
                IDOmitidos.push(TransactionID);
                return true;
            }

        }

        /*************************************************************************
         * Funcion guarda los calculos realizados previamente en el record
         * LatamReady - MX Transaction Fields
         *************************************************************************/
        function SaveRecordDIOT(recordObj, entityID, currency, exchangeRate, tranRelated, tranAux, opeType, Json_Aux, netamount, taxamount, grossamount, savecheck) {

            var MX_TransactionFields;

            var MX_TF_Search = search.create({
                type: "customrecord_lmry_mx_transaction_fields",
                columns: ["internalid", "custrecord_lmry_mx_paid_transaction", "custrecord_lmry_mx_entity_related"],
                filters: [
                    ["custrecord_lmry_mx_transaction_related", "IS", recordObj.id]
                ]
            }).run().getRange(0, 1000);

            var flag = true;
            if (MX_TF_Search != null && MX_TF_Search != "") {

                if (recordObj.type === "vendorpayment") {

                    for (var i = 0; i < MX_TF_Search.length; i++) {

                        var columns = MX_TF_Search[i].columns;
                        recordid = MX_TF_Search[i].getValue(columns[0]);
                        paidTran = MX_TF_Search[i].getValue(columns[1]);

                        if (paidTran == tranRelated) {
                            MX_TransactionFields = record.load({
                                type: 'customrecord_lmry_mx_transaction_fields',
                                id: recordid,
                                isDynamic: true
                            });
                            flag = false;
                            break;
                        }

                    }

                    if (flag) {
                        MX_TransactionFields = record.create({
                            type: 'customrecord_lmry_mx_transaction_fields',
                            isDynamic: true
                        });
                    }

                } else if (recordObj.type == 'expensereport') {

                    MX_TransactionFields = record.create({
                        type: 'customrecord_lmry_mx_transaction_fields',
                        isDynamic: true
                    });

                } else {

                    var columns = MX_TF_Search[0].columns;
                    recordid = MX_TF_Search[0].getValue(columns[0]);

                    MX_TransactionFields = record.load({
                        type: 'customrecord_lmry_mx_transaction_fields',
                        id: recordid,
                        isDynamic: true
                    });

                }

            } else {

                MX_TransactionFields = record.create({
                    type: 'customrecord_lmry_mx_transaction_fields',
                    isDynamic: true
                });

            }

            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_transaction_related',
                value: recordObj.id
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_entity_related',
                value: entityID
            });
            var taxRegNumer = getTaxRegNumber(entityID);
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_vatregnumber',
                value: taxRegNumer
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_currency',
                value: currency
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_exchange_rate',
                value: exchangeRate
            });
            if (tranRelated != null) {
                MX_TransactionFields.setValue({
                    fieldId: 'custrecord_lmry_mx_paid_transaction',
                    value: tranRelated
                });
            }
            if (tranAux != null) {
                MX_TransactionFields.setValue({
                    fieldId: 'custrecord_lmry_mx_transaction',
                    value: tranAux
                });
            }
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_operation_type',
                value: opeType
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_smx',
                value: Json_Aux['iva_smx'] ? Json_Aux['iva_smx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_dsmx',
                value: Json_Aux['iva_dsmx'] ? Json_Aux['iva_dsmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_ismx',
                value: Json_Aux['iva_ismx'] ? Json_Aux['iva_ismx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_iemx',
                value: Json_Aux['iva_iemx'] ? Json_Aux['iva_iemx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_zmx',
                value: Json_Aux['iva_zmx'] ? Json_Aux['iva_zmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_emx',
                value: Json_Aux['iva_emx'] ? Json_Aux['iva_emx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_snocmx',
                value: Json_Aux['iva_snocmx'] ? Json_Aux['iva_snocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_inocmx',
                value: Json_Aux['iva_inocmx'] ? Json_Aux['iva_inocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_s8mx',
                value: Json_Aux['iva_s8mx'] ? Json_Aux['iva_s8mx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_s4mx',
                value: Json_Aux['iva_s4mx'] ? Json_Aux['iva_s4mx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_s8nocmx',
                value: Json_Aux['iva_s8nocmx'] ? Json_Aux['iva_s8nocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_smx',
                value: Json_Aux['total_smx'] ? Json_Aux['total_smx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_dsmx',
                value: Json_Aux['total_dsmx'] ? Json_Aux['total_dsmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_ismx',
                value: Json_Aux['total_ismx'] ? Json_Aux['total_ismx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_iemx',
                value: Json_Aux['total_iemx'] ? Json_Aux['total_iemx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_zmx',
                value: Json_Aux['total_zmx'] ? Json_Aux['total_zmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_emx',
                value: Json_Aux['total_emx'] ? Json_Aux['total_emx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_snocmx',
                value: Json_Aux['total_snocmx'] ? Json_Aux['total_snocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_inocmx',
                value: Json_Aux['total_inocmx'] ? Json_Aux['total_inocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_s8mx',
                value: Json_Aux['total_s8mx'] ? Json_Aux['total_s8mx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_s4mx',
                value: Json_Aux['total_s4mx'] ? Json_Aux['total_s4mx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_total_s8nocmx',
                value: Json_Aux['total_s8nocmx'] ? Json_Aux['total_s8nocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_smx',
                value: Json_Aux['ret_smx'] ? Json_Aux['ret_smx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_dsmx',
                value: Json_Aux['ret_dsmx'] ? Json_Aux['ret_dsmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_ismx',
                value: Json_Aux['ret_ismx'] ? Json_Aux['ret_ismx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_iemx',
                value: Json_Aux['ret_iemx'] ? Json_Aux['ret_iemx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_zmx',
                value: Json_Aux['ret_zmx'] ? Json_Aux['ret_zmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_emx',
                value: Json_Aux['ret_emx'] ? Json_Aux['ret_emx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_snocmx',
                value: Json_Aux['ret_snocmx'] ? Json_Aux['ret_snocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_inocmx',
                value: Json_Aux['ret_inocmx'] ? Json_Aux['ret_inocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_s8mx',
                value: Json_Aux['ret_s8mx'] ? Json_Aux['ret_s8mx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_s4mx',
                value: Json_Aux['ret_s4mx'] ? Json_Aux['ret_s4mx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_ret_s8nocmx',
                value: Json_Aux['ret_s8nocmx'] ? Json_Aux['ret_s8nocmx'] : 0
            });
            MX_TransactionFields.setValue({
                fieldId: 'custrecord_lmry_mx_diot_iva_devoluciones',
                value: Json_Aux['devoluciones'] ? Json_Aux['devoluciones'] : 0
            });

            MX_TransactionFields.setValue({
                fieldId: "custrecord_lmry_mx_diot_ret_iva_total",
                value: Json_Aux["ret_total_iva"] || 0.00
            });

            if (netamount) {
                MX_TransactionFields.setValue({
                    fieldId: 'custrecord_lmry_mx_amount_net',
                    value: netamount
                });
            }
            if (taxamount) {
                MX_TransactionFields.setValue({
                    fieldId: 'custrecord_lmry_mx_amount_tax',
                    value: taxamount
                });
            }
            if (grossamount) {
                MX_TransactionFields.setValue({
                    fieldId: 'custrecord_lmry_mx_amount_total',
                    value: grossamount
                });
            }
            if (savecheck) {
                MX_TransactionFields.setValue({
                    fieldId: 'custrecord_lmry_mx_amount_save',
                    value: savecheck
                });
            }
            var saved = MX_TransactionFields.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
                disableTriggers: true
            });

        }

        // FUNCION PARA RECUPERAR EL TAX REG. NUMBER DE LA ENTIDAD
        function getTaxRegNumber(entityID) {

            try {

                var vendorSearch = search.lookupFields({
                    type: 'vendor',
                    id: entityID,
                    columns: ["taxRegistration.taxregistrationnumber"]
                });

                var taxRegNumer = vendorSearch["taxRegistration.taxregistrationnumber"];

                return taxRegNumer;

            } catch (e) {
                log.error('[ ST DIOT - getTaxRegNumber ]', e);
            }

        }

        return {
            CalculoDIOT: calculoDIOT
        }

    });
