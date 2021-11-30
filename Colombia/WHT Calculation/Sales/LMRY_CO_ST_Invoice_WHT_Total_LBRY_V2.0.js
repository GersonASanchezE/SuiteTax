/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = \
||   This script for customer center (Time)                           ||
||                                                                    ||
||  File Name: LMRY_CO_ST_Invoice_WHT_Total_LBRY_V2.0.js              ||
||                                                                    ||
||  Version Date         Author        Remarks                        ||
||  2.0     Nov 29 2021  LatamReady    Use Script 2.0                 ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define([
    'N/record',
    'N/search',
    'N/runtime',
    './LMRY_libSendingEmailsLBRY_V2.0',
    './LMRY_Log_LBRY_V2.0'
], function(record, search, runtime, Library_Mail, Library_Log) {
    
    var LMRY_SCRIPT = "LatamReady - CO ST Invoice WHT Lines LBRY 2.0";
    var LMRY_SCRIPT_NAME = "LMRY_CO_ST_Invoice_WHT_Lines_LBRY_V2.0.js ";

    // FEATURES
    var FEATURE_SUBSIDIARY = false;
    var FEATURE_MULTIBOOK = false;
    var FEATURE_APPROVAL = false;

    var MANDATORY_DEPARTMENT = false;
    var MANDATORY_CLASS = false;
    var MANDATORY_LOCATION = false;

    /*****************************************************************************************
     *  Funcion para calcular las retenciones por cabecera
     *      - recordObj: Record al cual se le aplicara las retenciones
     *      - scriptContext: Contexto del record
     *****************************************************************************************/
    function setWHTTotalTransaction (recordObj, scriptContext) {

        try {

            var type = scriptContext.type;
            var transactionID = recordObj.id;
            var transactionType = recordObj.type;

            if (type == "edit") {
                deleteRelatedRecords(transactionID)
            }

            FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
            FEATURE_MULTIBOOK = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });

            MANDATORY_DEPARTMENT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
            MANDATORY_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
            MANDATORY_LOCATION = runtime.isFeatureInEffect({ feature: "LOCATIONS" });

            
            
        } catch (error) {
            Library_Mail.sendemail('[ setWHTTotalTransaction]' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ setWHTTotalTransaction ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /*****************************************************************************************
     * Funcion que elimina los Journal Entry y Credit Memo que se hayan generado en el proceso
     *    - transactionID: ID de la transaccion
     *    - transactionType: Tipo de transaccion
     *****************************************************************************************/
    function deleteRelatedRecords (transactionID) {

        try {

            // Busqueda de transacciones relacionadas (Credit Memo)
            var CreditMemo_Search = search.create({
                type: record.Type.CREDIT_MEMO,
                columns: [ "internalid" ],
                filters: [
                    [ "custbody_lmry_reference_transaction", "IS", transactionID ],
                    "AND",
                    [ "mainline", "IS", "T" ]
                ]
            });

            var CreditMemo_SearchResult = CreditMemo_Search.run().getRange(0, 100);
            if (CreditMemo_SearchResult != null && CreditMemo_SearchResult.length > 0) {
                for (var i = 0; i < CreditMemo_SearchResult.length; i++) {
                    record.delete({
                        type: record.Type.CREDIT_MEMO,
                        id: Number(CreditMemo_SearchResult[i].getValue({ name: "internalid" }))
                    });
                }
            }

            // Busqueda de Journal Entry relacioadas
            var JournalEntry_Search = search.create({
                type: record.Type.JOURNAL_ENTRY,
                columns: [ "internalid" ],
                filters: [
                    [ "custbody_lmry_reference_transaction", "IS", "T" ]
                ]
            });

            var JournalEntry_SearchResult = JournalEntry_Search.run().getRange(0, 100);
            var auxID = 0;
            if (JournalEntry_SearchResult != null && JournalEntry_SearchResult.length > 0) {
                for (var i = 0; i < JournalEntry_SearchResult.length; i++) {
                    var JournalEntry_ID = JournalEntry_SearchResult[i].getValue({ name: "internalid" });
                    if (auxID != JournalEntry_ID) {
                        auxID = JournalEntry_ID;
                        record.delete({
                            type: record.Type.JOURNAL_ENTRY,
                            id: JournalEntry_ID
                        });
                    }
                }
            }
            
        } catch (error) {
            Library_Mail.sendemail('[ deleteRelatedRecords]' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ deleteRelatedRecords ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /*****************************************************************************************
     * Funcion para recuperar las retenciones que se le van a aplicar a la transaccion, esto
     * se recupera del Record "LatamReady - WHT Code"
     *    - transactionDate: Fecha de la transaccion
     *    - transactionCountry: Pais de la transaccion
     *****************************************************************************************/
    function _getWHTCodes (transactionDate, transactionCountry) {

        try {

            var WHTCode_Columns = [
                search.createColumn({ name: "name", label: "Name" }),
                search.createColumn({ name: "custrecord_lmry_wht_codedesc", label: "Description" }),
                search.createColumn({ name: "custrecord_lmry_wht_kind", label: "Withholding Tax Kind" }),
                search.createColumn({ name: "custrecord_lmry_wht_types", label: "Withholding Tax Type" }),
                search.createColumn({ name: "custrecord_lmry_wht_coderate", label: "Rate" }),
                search.createColumn({ name: "custrecord_lmry_wht_codeminbase", label: "Minimum Amount of Base" }),
                search.createColumn({ name: "custrecord_lmry_wht_saletaxpoint", label: "Sale WHT Point" }),
                search.createColumn({ name: "custrecord_lmry_wht_salebase", label: "Sale WHT Base" }),
                search.createColumn({ name: "custrecord_lmry_wht_taxcredacc", label: "Tax Credit/Asset Account" }),
                search.createColumn({ name: "custrecord_lmry_wht_taxliabacc", label: "Tax to pay / Liability Account" }),
                search.createColumn({ name: "custrecord_lmry_wht_taxitem_sales", label: "Sale Item WHT" })
            ];

            var WHTCode_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["T"] }),
                search.createFilter({ name: "custrecord_lmry_wht_codeuntil", operator: "ONORBEFORE", values: transactionDate }),
                search.createFilter({ name: "custrecord_lmry_wht_codefrom", operator: "ONORAFTER", values: transactionDate }),
                search.createFilter({ name: "custrecord_lmry_wht_onsales", operator: "IS", values: ["T"] }),
                search.createFilter({ name: "custrecord_lmry_wht_countries", operator: "ANYOF", values: transactionCountry })
            ];

            var WHTCode_Search = search.create({
                type: "customrecord_lmry_wht_code",
                columns: WHTCode_Columns,
                filters: WHTCode_Filters
            });

            var WHTCode_SearchResult = WHTCode_Search.run().getRange(0, 100);

            return WHTCode_SearchResult;
            
        } catch (error) {
            Library_Mail.sendemail('[ _getWHTCodes]' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getWHTCodes ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /*****************************************************************************************
     * FUNCION PARA OBTENER EL TIPO DE CAMBIO CON EL QUE SE VAN A REALIZAR LOS
     * CACULOS DE LAS RETENCIONES
     *    - recordObj: Registro de la transaccion
     *    - transactionSubsidiary: Subsidiaria de transaccion
     *    - STS_Json: Json con campos del record LatamReady - Setup Tax Subsidiary
     *****************************************************************************************/
     function _getExchangeRate(recordObj, transactionSubsidiary, STS_Json) {

        try {

            var transactionExchangeRate = recordObj.getValue({
                fieldId: "exchangerate"
            });

            var exchangeRate = 1;
            if ((FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") && (FEATURE_MULTIBOOK == true || FEATURE_MULTIBOOK == "T")) {

                var subsiadiarySearch = search.lookupFields({
                    type: search.Type.SUBSIDIARY,
                    id: transactionSubsidiary,
                    columns: ["currency"]
                });

                var subsidiaryCurrency = subsiadiarySearch.currency[0].value;
                if ((subsidiaryCurrency != STS_Json.currency) && (STS_Json.currency != "" && STS_Json.currency != null)) {

                    var bookLineCount = recordObj.getLineCount({
                        sublistId: "accountingbookdetail"
                    });
                    if (bookLineCount != "" && bookLineCount != null) {

                        for (var i = 0; i < bookLineCount; i++) {

                            var bookCurrency = recordObj.getSublistValue({
                                sublistId: "accountingbookdetail",
                                fieldId: "currency",
                                line: i
                            });
                            if (bookCurrency == STS_Json.currency) {
                                exchangerate = recordObj.getSublistValue({
                                    sublistId: "accountingbookdetail",
                                    fieldId: "exchangerate",
                                    line: i
                                });
                                break;
                            }

                        }

                    }

                } else {
                    exchangeRate = transactionExchangeRate;
                }

            } else {
                exchangeRate = transactionExchangeRate;
            }

            return exchangeRate;

        } catch (error) {
            Library_Mail.sendemail('[ _getExchangeRate ]' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getExchangeRate ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /*****************************************************************************************
     * Funcion para recuperar informacion del Record: LatamReady - Setup Tax Subsidiary
     *    - transactionSubsidiary: Subsiaria a filtrar para recuperar su configuración
     *****************************************************************************************/
     function _getSetupTaxSubsidiary(transactionSubsidiary) {

        try {

            var STS_Columns = [
                search.createColumn({ name: "custrecord_lmry_setuptax_subsidiary", label: "Latam - Subsidiary" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_currency", label: "Latam - Currency" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_tax_code", label: "Latam - Tax Code" }),
                search.createColumn({ name: "taxtype", join: "custrecord_lmry_setuptax_tax_code", label: "Tax Type" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_depclassloc", label: "Latam - Department, Class & Location" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_department", label: "Latam - Department" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_class", label: "Latam - Class" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_location", label: "Latam - Location" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_journal", label: "Latam - Journal Form" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_creditmemo", label: "Latam - Credit Memo Form" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_invoice", label: "Latam - Invoice Form" })
            ];

            var STS_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] })
            ];

            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                STS_Filters.push( search.createFilter({ name: "custrecord_lmry_setuptax_subsidiary", operator: "ANYOF", values: [transactionSubsidiary] }) );
            }

            var STS_Search = search.create({
                type: "customrecord_lmry_setup_tax_subsidiary",
                columns: STS_Columns,
                filters: STS_Filters
            });

            var STS_SearchResult = STS_Search.run().getRange(0, 10);
            var STS_Json = {};
            if (STS_SearchResult != null && STS_SearchResult.length > 0) {

                STS_Json["subsidiary"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_subsidiary" });
                STS_Json["currency"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_currency" });
                STS_Json["taxcode"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_tax_code" });
                STS_Json["taxtype"] = STS_SearchResult[0].getValue({ name: STS_SearchResult[0].columns[3] });
                STS_Json["depclassloc"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_depclassloc" });
                STS_Json["department"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_department" });
                STS_Json["class"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_class" });
                STS_Json["location"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_location" });

            }

            return STS_Json;

        } catch (error) {
            Library_Mail.sendemail('[ _getSetupTaxSubsidiary ]' + error, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getSetupTaxSubsidiary ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
        }

    }
    
});
