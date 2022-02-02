/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_AR_ST_WHT_TransactionFields_LBRY_V2.0.js    ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Sep 13 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define([
    'N/log', 'N/record', 'N/search', 'N/runtime', 'N/ui/serverWidget',
    './LMRY_libSendingEmailsLBRY_V2.0',
    './LMRY_Log_LBRY_V2.0'
], function(log, record, search, runtime, serverWidget, Library_Mail, Library_Log) {

    var LMRY_SCRIPT = 'LMRY - AR ST WHT Transaction Fields V2.0';
    var LMRY_SCRIPT_NAME = 'LMRY_AR_ST_WHT_TransactionFields_LBRY_V2.0.js';

    function setTransactionFields(context) {

        try {

            var recordID = context.newRecord.id;
            var recordType = context.newRecord.type;
            var type = context.type;

            var recordObj = record.load({
                id: recordID,
                type: recordType
            });

            if (type != "create") {
                // Elimina registros del record: LatamReady - Transaction Fields
                deleteTransactionFields(recordID);
            }

            var arrayData = [];
            var TCG_SearchResult = _getTaxCodeGroups();
            // log.debug('[ TCG_SearchResult] ', TCG_SearchResult);
            if (TCG_SearchResult != null && TCG_SearchResult.length > 0){

                for (var i = 0; i < TCG_SearchResult.length; i++) {

                    var TCG_Columns = TCG_SearchResult[i].columns
                    var TCG_Json = {
                        taxgroup: TCG_SearchResult[i].getValue(TCG_Columns[2]),
                        taxcode: TCG_SearchResult[i].getValue(TCG_Columns[3]),
                        taxfield: TCG_SearchResult[i].getValue(TCG_Columns[4]),
                        taxbase: TCG_SearchResult[i].getValue(TCG_Columns[5]),
                        baseamount: 0
                    };
                    // log.debug('[ TCG_Json ]', TCG_Json);
                    if (!TCG_Json.taxbase) {
                        continue;
                    }

                    var baseAmountTo = "";
                    switch (TCG_Json.taxbase) {
                        case "1":
                            baseAmountTo = "grossamt"
                            break;
                        case "2":
                            baseAmountTo = "taxamount";
                            break;
                        case "3":
                            baseAmountTo = "amount";
                            break;
                    }

                    var flagLines = false;

                    var taxDetailLineCount = recordObj.getLineCount({ sublistId: "taxdetails" });
                    if (taxDetailLineCount > 0) {

                        for (var j = 0; j < taxDetailLineCount; j++) {

                            var taxCode = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: j });
                            var baseAmount = 0;

                            if (baseAmountTo == "amount") {
                                baseAmount = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "netamount", line: j });
                            } else if (baseAmountTo == "taxamount") {
                                baseAmount = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: j });
                            } else {
                                var netAmount = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "netamount", line: j });
                                var taxAmount = recordObj.getSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: j });
                                baseAmount = netAmount + taxAmount;
                            }

                            if (TCG_Json.taxcode == taxCode) {
                                flagLines = true;
                                TCG_Json.baseamount += parseFloat(baseAmount);
                            }

                        } // fin for taxDetailLineCount

                    } // Fin if taxDetailLineCount

                    if (flagLines) {
                        arrayData.push(TCG_Json);
                    }

                } // Fin for TCG_SearchResult
                // log.debug('[ arrayData ]', arrayData);
                var auxArrayData = _groupByTaxGroup(arrayData);
                // log.debug('[ auxArrayData ]', auxArrayData);
                if (auxArrayData.length > 0) {
                    _saveTransactionFields(recordObj, auxArrayData);
                }

            } // Fin if TCG_SearchResult

        } catch (e) {
            Library_Mail.sendemail('[ afterSubmit - setTransactionFields ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - setTransactionFields ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * Realiza una agrupacion por: Latam - Tax Code Group y suma los importes
     ***************************************************************************/
    function _groupByTaxGroup (arrayData) {

        try {

            if (arrayData.length > 0) {

                var auxArrayData = [];
                var auxArrayIndex = -1;

                for (var i = 0; i < arrayData.length; i++) {

                    if (auxArrayData.length == 0){

                        var auxTCG_Json = {
                            taxgroup: arrayData[i].taxgroup,
                            taxfield: arrayData[i].taxfield,
                            baseamount: arrayData[i].baseamount
                        };

                        auxArrayIndex += 1;
                        auxArrayData[auxArrayIndex] = auxTCG_Json;

                    } else {

                        if (auxArrayData[auxArrayIndex].taxgroup != arrayData[i].taxgroup) {

                            var auxTCG_Json = {
                                taxgroup: arrayData[i].taxgroup,
                                taxfield: arrayData[i].taxfield,
                                baseamount: arrayData[i].baseamount
                            };

                            auxArrayIndex += 1;
                            auxArrayData[auxArrayIndex] = auxTCG_Json;

                        } else {
                            auxArrayData[auxArrayIndex].baseamount += arrayData[i].baseamount;
                        }

                    }

                }

                return auxArrayData

            }

        } catch (e) {
            Library_Mail.sendemail('[ afterSubmit - groupByTaxGroup ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - groupByTaxGroup ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * Guarda registros al record: LatamReady - Tax Code Group
     ***************************************************************************/
    function _saveTransactionFields(recordObj, auxArrayData) {

        try {

            var TF_Record = record.create({
                type: 'customrecord_lmry_transactions_fields',
                isDynamic: true
            });

            TF_Record.setValue({ fieldId: "custrecord_lmry_transaction_f", value: recordObj.id });
            TF_Record.setValue({ fieldId: "custrecord_lmry_transaction_f_id", value: recordObj.id });
            TF_Record.setValue({ fieldId: "custrecord_lmry_transaction_f_exento", value: 0 });
            TF_Record.setValue({ fieldId: "custrecord_lmry_transaction_f_iva", value: 0 });
            TF_Record.setValue({ fieldId: "custrecord_lmry_transaction_f_gravado", value: 0 });
            TF_Record.setValue({ fieldId: "custrecord_lmry_transaction_f_no_gravado", value: 0 });

            for (var i = 0; i < auxArrayData.length; i++) {
                TF_Record.setValue({
                    fieldId: auxArrayData[i].taxfield,
                    value: Math.round(parseFloat(auxArrayData[i].baseamount) * 100) / 100
                });
            }

            TF_Record.save({
                ignoreMandatoryFields: true,
                disableTriggers: true,
                enableSourcing: true
            });

        } catch (e) {
            Library_Mail.sendemail('[ afterSubmit - saveTransactionFields ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - saveTransactionFields ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * Elimina registros del record: LatamReady - Tax Code Group
     ***************************************************************************/
    function deleteTransactionFields(recordID) {

        try {
            // TF: Transaction Fields
            var TF_Search = search.create({
                type: "customrecord_lmry_transactions_fields",
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "custrecord_lmry_transaction_f", label: "Latam AR - Related Transaction" })
                ],
                filters: [
                    search.createFilter({ name: "custrecord_lmry_transaction_f_id", operator: "EQUALTO", values: [recordID] })
                ]
            });

            var TF_SearchResult = TF_Search.run().getRange(0, 1000);

            if (TF_SearchResult != null && TF_SearchResult.length > 0) {
                for (var i = 0; i < TF_SearchResult.length; i++) {
                    record.delete({
                        type: "customrecord_lmry_transactions_fields",
                        id: TF_SearchResult[i].getValue({ name: "internalid" })
                    });
                }
            }

        } catch (e) {
            Library_Mail.sendemail('[ afterSubmit - deleteTransactionFields ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - deleteTransactionFields ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * Busqueda al record: LatamReady - Tax Code Group
     ***************************************************************************/
    function _getTaxCodeGroups() {

        try {

            var TCG_Columns = [
                search.createColumn({ name: "internalid", label: "Internald ID" }),
                search.createColumn({ name: "custrecord_lmry_setup_taxcode_country", label: "Latam - Country" }),
                search.createColumn({ name: "custrecord_lmry_setup_taxcode_group", sort: search.Sort.ASC, label: "Latam - Tax Code Group" }),
                search.createColumn({ name: "custrecord_lmry_setup_taxcode", label: "Latam - Tax Code" }),
                search.createColumn({ name: "custrecord_lmry_setup_id_custbody", join: "custrecord_lmry_setup_taxcode_group", label: "Latam - Setup ID Custbody" }),
                search.createColumn({ name: "custrecord_lmry_setup_amount_to", join: "custrecord_lmry_setup_taxcode_group", label: "Latam - Setup Amount To" })
            ];

            var TCG_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] })
            ];

            var TCG_Search = search.create({
                type: "customrecord_lmry_setup_taxcode_group",
                columns: TCG_Columns,
                filters: TCG_Filters
            });

            var TCG_SearchResult = TCG_Search.run().getRange(0, 1000);

            return TCG_SearchResult;

        } catch (e) {
            Library_Mail.sendemail('[ afterSubmit - getTaxCodeGroups ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ afterSubmit - getTaxCodeGroups ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    return {
        setTransactionFields: setTransactionFields,
        deleteTransactionFields: deleteTransactionFields
    };

});
