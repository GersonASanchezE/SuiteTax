/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_TaxResult_Engine_LBRY_V2.1.js               ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.1     Feb 07 2022  LatamReady    Bundle 37714             ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 */

define([
    'N/log',
    'N/search',
    './LMRY_libSendingEmailsLBRY_V2.0',
    './LMRY_Log_LBRY_V2.0.js'
], (log, search, Library_Mail, Library_Log) => {

    // Script information
    const LMRY_SCRIPT = "LatamReaady - Tax Result Engine LBRY V2.1";
    const LMRY_SCRIPT_NAME = "LMRY_TaxResult_Engine_LBRY_V2.1.js ";

    /***************************************************************************
     * FUNCIÓN QUE PERMITE RECUPERAR LA RELACIÓN DE TODAS LA SUBSIDIARIAS
     * PERTENIENCIENTES A LA CUENTA Y QUE ESTÉN COFIGURADAS
     ***************************************************************************/
    const getAllSubsidiaries = () => {

        try {

            let allSubsidiaries = [];

            let Subsidiary_Search = search.create({
                type: search.Type.SUBSIDIARY,
                filters: [
                    search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] })
                ],
                columns: [
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "name", label: "Name" })
                ]
            }).run().getRange(0, 1000);

            if (Subsidiary_Search != null && Subsidiary_Search.length > 0) {
                for (var i = 0; i < Subsidiary_Search.length; i++) {
                    allSubsidiaries.push({
                        text: Subsidiary_Search[i].getValue({ name: "name" }),
                        value: Subsidiary_Search[i].getValue({ name: "internalid" }),
                        active: false
                    });
                }
            }

            return allSubsidiaries;

        } catch (e) {
            log.error('[ getAllSubsidiaries ]', e);
            Library_Mail.sendemail('[ getAllSubsidiaries ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ getAllSubsidiaries ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    /***************************************************************************
     * FUNCIÓN QUE PERMITE RECUPERAR REGISTROS DEL RECORD: "LATAMREADY - STE
     * LATAMTAX JSON RESULT" DE ACUERDO A LOS PARAMETROS ESTABLECIDOS QUE SERAN
     * SUS FILTROS
     * PARAMETROS:
     *      - paramSubsidiary: Subsidiaria del cual traerá los registros
     *      - paramDateFrom: Fecha desde que se traerán los registros
     *      - paramDateTo: Fecha hasta que se traerán los registros
     ***************************************************************************/
    const getJsonResult = (paramSubsidiary, paramDateFrom, paramDateTo) => {

        try {

            let Json_Columns = [
                search.createColumn({ name: "internalid", label: "Internal ID" }),
                search.createColumn({ name: "custrecord_lmry_ste_related_transaction", label: "LATAM - STE RELATED TRANSACTION" }),
                search.createColumn({ name: "type", join : "custrecord_lmry_ste_related_transaction", label: "Record Type" }),
                search.createColumn({ name: "postingperiod", join : "custrecord_lmry_ste_related_transaction", label: "Posting Perioid" }),
                search.createColumn({ name: "mainname", join : "custrecord_lmry_ste_related_transaction", label: "Entity" }),
                search.createColumn({ name: "custrecord_lmry_ste_transaction_date", label: "LATAM - STE TRANSACTION DATE" }),
            ];

            let Json_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] }),
                search.createFilter({ name: "custrecord_lmry_ste_subsidiary", operator: "ANYOF", values: [paramSubsidiary] }),
                search.createFilter({ name: "custrecord_lmry_ste_transaction_date", operator: "ONORBEFORE", values: [paramDateTo] }),
                search.createFilter({ name: "custrecord_lmry_ste_transaction_date", operator: "ONORAFTER", values: [paramDateFrom] }),
                search.createFilter({ name: "mainline", join: "custrecord_lmry_ste_related_transaction", operator: "IS", values: ["T"] })
            ];

            let Json_Search = search.create({
                type: "customrecord_lmry_ste_json_result",
                filters: Json_Filters,
                columns: Json_Columns
            });

            let jsonResult = [];
            let myPageData = Json_Search.runPaged(1000);
            myPageData.pageRanges.forEach((pageRange) => {

                let myPage = myPageData.fetch({ index: pageRange.index });
                myPage.data.forEach((result) => {

                    jsonResult.push({
                        internalid:result.getValue({ name: "internalid" }),
                        transaction: {
                            text: result.getText({ name: "custrecord_lmry_ste_related_transaction" }),
                            value: result.getValue({ name: "custrecord_lmry_ste_related_transaction" })
                        },
                        transaction_type: {
                            text: result.getText({ name: "type", join: "custrecord_lmry_ste_related_transaction" }),
                            value: result.getValue({ name: "type", join: "custrecord_lmry_ste_related_transaction" })
                        },
                        transaction_period: {
                            text: result.getText({ name: "postingperiod", join: "custrecord_lmry_ste_related_transaction" }),
                            value: result.getValue({ name: "postingperiod", join: "custrecord_lmry_ste_related_transaction" })
                        },
                        transaction_entity: {
                            text: result.getText({ name: "mainname", join: "custrecord_lmry_ste_related_transaction" }),
                            value: result.getValue({ name: "mainname", join: "custrecord_lmry_ste_related_transaction" })
                        },
                        date: result.getValue({ name: "custrecord_lmry_ste_transaction_date" })
                    });

                });

            });

            return jsonResult;

        } catch (e) {
            log.error('[ getJsonResult ]', e);
            Library_Mail.sendemail('[ getJsonResult ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ getJsonResult ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    return {
        getAllSubsidiaries: getAllSubsidiaries,
        getJsonResult: getJsonResult
    };

})
