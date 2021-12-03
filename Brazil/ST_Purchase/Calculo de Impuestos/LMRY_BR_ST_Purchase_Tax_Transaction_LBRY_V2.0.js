/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_ST_Purchase_Tax_Transaction_LBRY_V2.0.js ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 05 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define([
    'N/log',
    'N/record',
    'N/search',
    'N/runtime',
    'N/suiteAppInfo',
    './LMRY_Log_LBRY_V2.0.js',
    './LMRY_libSendingEmailsLBRY_V2.0'
], function (log, record, search, runtime, suiteAppInfo, Library_Log, Lirabry_Mail) {

    var LMRY_Script = "LMRY BR ST Purchase Tax Transaction LBRY V2.0";
    var LMRY_script_Name = "LMRY_BR_ST_Purchase_Tax_Transaction_LBRY_V2.0.js";

    var FEATURE_SUBSIDIARY = false;
    var FEATURE_MULTIBOOK = false;

    var FEATURE_DEPARTMENT = false;
    var FEATURE_CLASS = false;
    var FEATURE_LOCATION = false;

    var MANDATORY_DEPARTMENT = false;
    var MANDATORY_CLASS = false;
    var MANDATORY_LOCATION = false;

    /***************************************************************************
     *  Función donde se hará el proceso de LatamTax Purchase el cual realiza
     *  el cálculo de impuesto según lo configurao.
     *  Parámetros:
     *      - context: Objeto JSON donde tiene el record y el tipo de acció
     *          a realizar (create, edit o copy).
     ***************************************************************************/
    function setTaxTransaction (context) {

        try {

            var recordObj = context.newRecord;
            var actionType = context.type;

            var transactionID = recordObj.id;
            var transactionType = recordObj.type;

            if (["create", "edit", "copy"].indexOf(actionType) != -1) {

                var taxDetailOverride = recordObj.getValue({ fieldId: "taxdetailsoverride" });
                if (taxDetailOverride == true || taxDetailOverride == "T") {

                    FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
                    FEATURE_MULTIBOOK = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });

                    FEATURE_DEPARTMENT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
                    FEATURE_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
                    FEATURE_LOCATION = runtime.isFeatureInEffect({ feature: "LOCATIONS" });

                    MANDATORY_DEPARTMENT = runtime.getCurrentUser().getPreference({ name: "DEPTMANDATORY" });
                    MANDATORY_CLASS = runtime.getCurrentUser().getPreference({ name: "CLASSMANDATORY" });
                    MANDATORY_LOCATION = runtime.getCurrentUser().getPreference({ name: "LOCMANDATORY" });

                    var filtroTransactionType = "";
                    switch (transactionType) {
                        case "purchaseorder":
                            filtroTransactionType = 6;
                            break;
                        case "vendorbill":
                            filtroTransactionType = 4;
                            break;
                        case "vendorcredit":
                            filtroTransactionType = 7;
                            break;
                        case "itemfulfillment":
                            filtroTransactionType = 12;
                            break;
                        case "creditcardcharge":
                            filtroTransactionType = 15;
                            break;
                        case "creditcardrefund":
                            filtroTransactionType = 16;
                            break;
                        default:
                            return true;
                    }

                    var STS_JSON = _getSetupTaxSubsidiary(transactionSubsidiary);
                    var exchangeRate = _getExchangeRate(recordObj, STS_JSON);

                }

            }

        } catch (e) {
            Lirabry_Mail.sendemail('[ afterSubmit - setTaxTransaction ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ afterSubmit - setTaxTransaction ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función donde se va a obtener el tipo de cambio de la transacción o
     *  MultiBook para la conversión a la moneda base
     *  Parámetros:
     *      - recordObj: Record de la transacción
     *      - STS_JSON: JSON con la configuración del Setup Tax Subsidiary
     ***************************************************************************/
    function _getExchangeRate(recordObj, STS_JSON) {

        try {

        } catch (e) {
            Lirabry_Mail.sendemail('[ _getExchangeRate ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getExchangeRate ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función donde se realizará un búsqueda para recuperar la configuración
     *  de la subsidiaria en el Record: "LatamReady - Setup Tax Subsidiary"
     *  Parámetros:
     *      - transactionSubsidiary: Subsidiaria del cual se va a recuperar su
     *          configuración
     ***************************************************************************/
    function _getSetupTaxSubsidiary(transactionSubsidiary) {

        try {

            var STS_Columns = [
                search.createColumn({ name: "custrecord_lmry_setuptax_subsidiary", label: "Latam - Subsidiary" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_currency", label: "Latam - Currency" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_type_rounding", label: "Latam - Rounding Type" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_depclassloc", label: "latam - Department, Class and Location" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_department", label: "Latam - Department" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_class", label: "Latam - Class" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_location", label: "Latam - Location" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_bill", label: "Latam - Bill Form" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_credit", label: "Latam - Bill Credit Form" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_form_journal", label: "Latam - Journal Form" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_br_ap_flow", label: "Latam A/P - Calculation Flow" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_br_province", label: "Latam - BR Province" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_br_difal_acct", label: "Latam - BR Difal Account" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_br_difal_obs", label: "Latam - BR Difal Observation" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_br_minimum_purc", label: "Latam - BR Minimum Tax Purchase" })

            ];

            var STS_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] })
            ];
            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                STS_Filters.push(search.createFilter({ name: "custrecord_lmry_setuptax_subsidiary", operator: "IS", values: transactionSubsidiary }));
            }

            var STS_Search = search.create({
                type: "customrecord_lmry_setup_tax_subsidiary",
                columns: STS_Columns,
                filters: STS_Filters
            });
            var STS_SearchResult = STS_Search.run().getRange(0, 10);

            var STS_JSON = {};
            if (STS_SearchResult != null  && STS_SearchResult.length > 0) {
                STS_JSON["subsidiary"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_subsidiary" });
                STS_JSON["currency"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_currency" });
                STS_JSON["rounding"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_type_rounding" });
                STS_JSON["depclassloc"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_depclassloc" });
                STS_JSON["department"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_department" });
                STS_JSON["class"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_class" });
                STS_JSON["location"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_location" });
                STS_JSON["billform"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_bill" });
                STS_JSON["billcreditform"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_credit" });
                STS_JSON["journalform"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_journal" });
                STS_JSON["taxflow"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_ap_flow" }) || 1;
                STS_JSON["br_province"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_province" });
                STS_JSON["br_difal_acc"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_difal_acct" });
                STS_JSON["br_difal_obs"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_difal_obs" });
                STS_JSON["br_min_tax_purch"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_minimum_purc" });
            }
            log.debug('[ STS_JSON ]', STS_JSON);
            return STS_JSON;

        } catch (e) {
            Lirabry_Mail.sendemail('[ _getSetupTaxSubsidiary ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getSetupTaxSubsidiary ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

});
