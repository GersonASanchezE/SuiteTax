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

                    var transactionSubsidiary = "";
                    if (FEATURE_SUBSIDIARY == true) {
                        transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
                    } else {
                        transactionSubsidiary = recordObj.getValue({ fieldId: "custbody_lmry_subsidiary_country" });
                    }

                    var STS_JSON = _getSetupTaxSubsidiary(transactionSubsidiary);
                    var exchangeRate = _getExchangeRate(recordObj, STS_JSON);
                    var CC_SearchResult = _getContributoryClasses(recordObj, filtroTransactionType, transactionSubsidiary);
                    var NT_SearchResult = _getNationalTaxes(recordObj, filtroTransactionType, transactionSubsidiary);

                }

            }

        } catch (e) {
            Lirabry_Mail.sendemail('[ afterSubmit - setTaxTransaction ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ afterSubmit - setTaxTransaction ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function _getNationalTaxes(recordObj, filtroTransactionType, transactionSubsidiary) {

        try {

            var transactionDate = recordObj.getText({ fieldId: "tandate" });
            var transactionDocType = recordObj.getValue({ fieldId: "custbody_lmry_document_type" });
            var transactionProvince = recordObj.getValue({ fieldId: "custbody_lmry_province" });
            var transactionCity = recordObj.getValue({ fieldId: "custbody_lmry_city" });
            var transactionDistrict = recordObj.getValue({ fieldId: "custbody_lmry_district" });

            var NT_Columns = [
                search.createColumn({ name: "internalid", label: "INTERNAL ID" }),
                search.createColumn({ name: "custrecord_lmry_ntax_gen_transaction", label: "LATAM - GENERATED TRANSACTION?" }),
                search.createColumn({ name: "custrecord_lmry_ntax_description", label: "LATAM - WITHHOLDING DESCRIPTION" }),
                search.createColumn({ name: "custrecord_lmry_ntax_taxtype", label: "LATAM - TAX TYPE" }),
                search.createColumn({ name: "custrecord_lmry_ntax_sub_type", label: "LATAM - SUB TYPE" }),
                search.createColumn({ name: "custrecord_lmry_tax_by_location", join: "custrecord_lmry_ntax_sub_type", label: "TAX BY LOCATION?" }),
                search.createColumn({ name: "custrecord_lmry_br_is_import_tax", join: "custrecord_lmry_ntax_sub_type", label: "LATAM - BR IS IMPORT TAX?" }),
                search.createColumn({ name: "custrecord_lmry_is_tax_not_included", join: "custrecord_lmry_ntax_sub_type", label: "LATAM - BR IS TAX NOT INCLUDED?" }),
                search.createColumn({ name: 'custrecord_lmry_nt_ste_tax_type', label: 'Latam - STE TAX TYPE' }),
                search.createColumn({ name: 'custrecord_lmry_nt_ste_tax_code', label: 'Latam - STE TAX CODE' }),
                search.createColumn({ name: "custrecord_lmry_ntax_tax_rule", label: "LATAM BR - TAX RULE" }),
                search.createColumn({ name: "custrecord_lmry_ntax_taxrate_pctge", label: "LATAM - TAX RATE" }),
                search.createColumn({ name: "custrecord_lmry_ntax_amount", label: "LATAM - AMOUNT TO" }),
                search.createColumn({ name: "custrecord_lmry_ntax_addratio", label: "LATAM - ADDITIONAL RATIO" }),
                search.createColumn({ name: "custrecord_lmry_ntax_minamount", label: "LATAM - MINIMUN AMOUNT" }),
                search.createColumn({ name: "custrecord_lmry_ntax_maxamount", label: "LATAM - MAXIMUN AMOUNT" }),
                search.createColumn({ name: "custrecord_lmry_ntax_set_baseretention", label: "LATAM - SET BASE RETENTION" }),
                search.createColumn({ name: "custrecord_lmry_ntax_isexempt", label: "LATAM - IS EXEMPT?" }),
                search.createColumn({ name: "custrecord_lmry_ntax_base_amount", label: "LATAM - BASE AMOUNT?" }),
                search.createColumn({ name: "custrecord_lmry_ntax_not_taxable_minimum", label: "LATAM - NOT TAXABLE MINIMUM" }),
                search.createColumn({ name: "custrecord_lmry_ntax_gl_impact", label: "LATAM BR - GL IMPACT?" }),
                search.createColumn({ name: "custrecord_lmry_nt_is_reduction", label: "LATAM - IS REDUCTION?" }),
                search.createColumn({ name: "custrecord_lmry_nt_is_substitution", label: "LATAM BR - ES SUSTITUCIÓN TRIBUTARIA?" }),
                search.createColumn({ name: "custrecord_lmry_ntax_taxitem", label: "LATAM - TAX ITEM" }),
                search.createColumn({ name: "custrecord_lmry_ntax_taxcode", label: "LATAM - TAX CODE" }),
                search.createColumn({ name: "custrecord_lmry_ntax_department", label: "LATAM - DEPARTMENT" }),
                search.createColumn({ name: "custrecord_lmry_ntax_class", label: "LATAM - CLASS" }),
                search.createColumn({ name: "custrecord_lmry_ntax_location", label: "LATAM - LOCATION" }),
                search.createColumn({ name: "custrecord_lmry_ntax_credit_account", label: "LATAM - CREDIT ACCOUNT" }),
                search.createColumn({ name: "custrecord_lmry_ntax_debit_account", label: "LATAM - DEBIT ACCOUNT" }),
                search.createColumn({ name: "custrecord_lmry_br_ntax_exclusive", label: "LATAM BR - TELECOMMUNICATION TAX" }),
                search.createColumn({ name: "custrecord_lmry_ntax_br_receita", label: "LATAM BR - RECEITA" }),
                search.createColumn({ name: "custrecord_lmry_br_ntax_tax_situation", label: "LATAM BR - TAX SITUATION" }),
                search.createColumn({ name: "custrecord_lmry_br_ntax_nature_revenue", label: "LATAM BR - NATURE OF REVENUE" }),
                search.createColumn({ name: "custrecord_lmry_br_ntax_regimen_catalog", label: "LATAM BR - CATALOG ASSOCIATED REGIMEN" }),
                search.createColumn({ name: "custrecord_lmry_ntax_difal", label: "LATAM - TAX DIFAL" }),
                search.createColumn({ name: "custrecord_lmry_nt_br_apply_report", label: "LATAM - APLICA LIBRO LEGAL" }),
                search.createColumn({ name: "custrecord_lmry_ntax_fa_tax_rate", label: "LATAM - BR FA TAX RATE" })
            ];

            var NT_Filters = [
                [ "isinactive", "IS", "F" ], "AND",
                [ "custrecord_lmry_ntax_datefrom", "ONORBEFORE", transactionDate ], "AND",
                [ "custrecord_lmry_ntax_dateto", "ONORAFTER", transactionDate ], "AND",
                [ "custrecord_lmry_ntax_transactiontypes", "ANYOF", filtroTransactionType ], "AND",
                [ "custrecord_lmry_ntax_taxtype", "ANYOF", "4" ], "AND",
                [ "custrecord_lmry_ntax_appliesto", "ANYOF", "2" ], "AND",
                [ "custrecord_lmry_ntax_gen_transaction", "ANYOF", "3" ]
            ];

            var documents = ["@NONE@"];
            if (transactionDocType) {
                documents.push(transactionDocType);
            }
            NT_Filters.push("AND", [ "custrecord_lmry_ntax_fiscal_doctype", "ANYOF", documents ]);

            if (FEATURE_SUBSIDIARY) {
                NT_Filters.push("AND", [ "custrecord_lmry_ntax_subsidiary", "ANYOF", transactionSubsidiary ]);
            }

            var provinces = ["@NONE@"];
            if (transactionProvince) {
                provinces.push(transactionProvince);
            }

            var cities = ["@NONE@"];
            if (transactionCity) {
                cities.push(transactionCity);
            }

            var districts = ["@NONE@"];
            if (transactionDistrict) {
                districts.push(transactionDistrict);
            }

            NT_Filters.push([
                [
                    [ "custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "IS", "F" ]
                ],
                "OR",
                [
                    [ "custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "IS", "T" ], "AND",
                    [ "custrecord_lmry_ntax_province", "ANYOF", provinces ], "AND",
                    [ "custrecord_lmry_ntax_city", "ANYOF", cities ], "AND",
                    [ "custrecord_lmry_ntax_district", "ANYOF", districts ]
                ]
            ]);

            var NT_Search = search.create({
                type: "customrecord_lmry_national_taxes",
                columns: NT_Columns,
                filters: NT_Filters
            }).run().getRange(0, 1000);

            return NT_Search;

        } catch (e) {
            Lirabry_Mail.sendemail('[ _getNationalTaxes ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getNationalTaxes ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hará una búsqueda en el Record: "LatamReady - Contributory
     *  Class". Del culál se va a recuperar los registros configurados para este
     *  proceso, según los filtros que se pongan
     *  Parámetros:
     *      - recordObj: Record de la transacción
     ***************************************************************************/
    function _getContributoryClasses(recordObj, filtroTransactionType, transactionSubsidiary) {

        try {

            var transactionDate = recordObj.getText({ fieldId: "tandate" });
            var transactionEntity = recordObj.getValue({ fieldId: "entity" });
            var transactionDocType = recordObj.getValue({ fieldId: "custbody_lmry_document_type" });
            var transactionProvince = recordObj.getValue({ fieldId: "custbody_lmry_province" });
            var transactionCity = recordObj.getValue({ fieldId: "custbody_lmry_city" });
            var transactionDistrict = recordObj.getValue({ fieldId: "custbody_lmry_district" });

            var CC_Columns = [
                search.createColumn({ name: "internalid", label: "INTERNAL ID" }),
                search.createColumn({ name: "custrecord_lmry_ccl_gen_transaction", label: "LATAM - GENERATED TRANSACTION?" }),
                search.createColumn({ name: "custrecord_lmry_ccl_description", label: "LATAM - WITHHOLDING DESCRIPTION" }),
                search.createColumn({ name: "custrecord_lmry_ccl_taxtype", label: "LATAM - TAX TYPE" }),
                search.createColumn({ name: "custrecord_lmry_sub_type", label: "LATAM - SUB TYPE" }),
                search.createColumn({ name: "custrecord_lmry_tax_by_location", join: "custrecord_lmry_sub_type", label: "TAX BY LOCATION?" }),
                search.createColumn({ name: "custrecord_lmry_br_is_import_tax", join: "custrecord_lmry_sub_type", label: "LATAM - BR IS IMPORT TAX?" }),
                search.createColumn({ name: "custrecord_lmry_is_tax_not_included", join: "custrecord_lmry_sub_type", label: "LATAM - BR IS TAX NOT INCLUDED?" }),
                search.createColumn({ name: 'custrecord_lmry_cc_ste_tax_type', label: 'Latam - STE TAX TYPE' }),
                search.createColumn({ name: 'custrecord_lmry_cc_ste_tax_code', label: 'Latam - STE TAX CODE' }),
                search.createColumn({ name: "custrecord_lmry_ccl_tax_rule", label: "LATAM BR - TAX RULE" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_taxrate", label: "LATAM - TAX RATE" }),
                search.createColumn({ name: "custrecord_lmry_amount", label: "LATAM - AMOUNT TO" }),
                search.createColumn({ name: "custrecord_lmry_ccl_addratio", label: "LATAM - ADDITIONAL RATIO" }),
                search.createColumn({ name: "custrecord_lmry_ccl_minamount", label: "LATAM - MINIMUN AMOUNT" }),
                search.createColumn({ name: "custrecord_lmry_ccl_maxamount", label: "LATAM - MAXIMUN AMOUNT" }),
                search.createColumn({ name: "custrecord_lmry_ccl_set_baseretention", label: "LATAM - SET BASE RETENTION" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_isexempt", label: "LATAM - IS EXEMPT?" }),
                search.createColumn({ name: "custrecord_lmry_ccl_base_amount", label: "LATAM - BASE AMOUNT?" }),
                search.createColumn({ name: "custrecord_lmry_ccl_not_taxable_minimum", label: "LATAM - NOT TAXABLE MINIMUM" }),
                search.createColumn({ name: "custrecord_lmry_ccl_gl_impact", label: "LATAM BR - GL IMPACT?" }),
                search.createColumn({ name: "custrecord_lmry_ccl_is_reduction", label: "LATAM - IS REDUCTION?" }),
                search.createColumn({ name: "custrecord_lmry_ccl_is_substitution", label: "LATAM BR - ES SUSTITUCIÓN TRIBUTARIA?" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_taxitem", label: "LATAM - TAX ITEM" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_taxcode", label: "LATAM - TAX CODE" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_department", label: "LATAM - DEPARTMENT" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_class", label: "LATAM - CLASS" }),
                search.createColumn({ name: "custrecord_lmry_ar_ccl_location", label: "LATAM - LOCATION" }),
                search.createColumn({ name: "custrecord_lmry_br_ccl_account2", label: "LATAM - CREDIT ACCOUNT" }),
                search.createColumn({ name: "custrecord_lmry_br_ccl_account1", label: "LATAM - DEBIT ACCOUNT" }),
                search.createColumn({ name: "custrecord_lmry_br_exclusive", label: "LATAM BR - TELECOMMUNICATION TAX" }),
                search.createColumn({ name: "custrecord_lmry_br_receita", label: "LATAM BR - RECEITA" }),
                search.createColumn({ name: "custrecord_lmry_br_taxsituation", label: "LATAM BR - TAX SITUATION" }),
                search.createColumn({ name: "custrecord_lmry_br_nature_revenue", label: "LATAM BR - NATURE OF REVENUE" }),
                search.createColumn({ name: "custrecord_lmry_br_ccl_regimen_catalog", label: "LATAM BR - CATALOG ASSOCIATED REGIMEN" }),
                search.createColumn({ name: "custrecord_lmry_ccl_difal", label: "LATAM - TAX DIFAL" }),
                search.createColumn({ name: "custrecord_lmry_ccl_br_apply_report", label: "LATAM - APLICA LIBRO LEGAL" }),
                search.createColumn({ name: "custrecord_lmry_ccl_fa_tax_rate", label: "LATAM - BR FA TAX RATE" })
            ];

            var CC_Filters = [
                [ "isinactive", "IS", "F" ], "AND",
                [ "custrecord_lmry_ar_ccl_fechdesd", "ONORBEFORE", transactionDate ], "AND",
                [ "custrecord_lmry_ar_ccl_fechhast", "ONORAFTER", transactionDate ], "AND",
                [ "custrecord_lmry_ccl_transactiontypes", "ANYOF", filtroTransactionType ], "AND",
                [ "custrecord_lmry_ar_ccl_entity", "ANY", transactionEntity ], "AND",
                [ "custrecord_lmry_ccl_appliesto", "ANYOF", "2" ], "AND",
                [ "custrecord_lmry_ccl_taxtype", "ANYOF", "4" ], "AND",
                [ "custrecord_lmry_ccl_gen_transaction", "ANYOF", "3" ]
            ];

            var documents = ["@NONE@"];
            if (transactionDocType) {
                documents.push(transactionDocType);
            }
            CC_Filters.push("AND", [ "custrecord_lmry_ccl_fiscal_doctype", "ANYOF", documents ]);

            if (FEATURE_SUBSIDIARY) {
                CC_Filters.push("AND", [ "custrecord_lmry_ar_ccl_subsidiary", "ANYOF", transactionSubsidiary ]);
            }

            var provinces = ["@NONE@"];
            if (transactionProvince) {
                provinces.push(transactionProvince);
            }

            var cities = ["@NONE@"];
            if (transactionCity) {
                cities.push(transactionCity);
            }

            var districts = ["@NONE@"];
            if (transactionDistrict) {
                districts.push(transactionDistrict);
            }

            CC_Filters.push([
                [
                    [ "custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "IS", "F" ]
                ],
                "OR",
                [
                    [ "custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "IS", "T" ], "AND",
                    [ "custrecord_lmry_ccl_province", "ANYOF", provinces ], "AND",
                    [ "custrecord_lmry_ccl_city", "ANYOF", cities ], "AND",
                    [ "custrecord_lmry_ccl_district", "ANYOF", districts ]
                ]
            ]);

            var CC_Search = search.create({
                type: "customrecord_lmry_ar_contrib_class",
                columns: CC_Columns,
                filters: CC_Filters
            }).run().getRange(0, 1000);

            return CC_Search;

        } catch (e) {
            Lirabry_Mail.sendemail('[ _getContributoryClasses ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getContributoryClasses ]', message: e, relatedScript: LMRY_script_Name });
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

            var exchangeRate = 1;
            var transactionCurrency = recordObj.getValue({ fieldId: "currency" });

            if (FEATURE_SUBSIDIARY == true && FEATURE_MULTIBOOK == true) { // OneWorld & Multibook

                var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
                var subsidiaryCurrency = search.lookupFields({ type: "subsidiary", id: transactionSubsidiary, columns: ["currency"] }).currency[0].value;

                if ((subsidiaryCurrency != STS_JSON.currency) && (STS_JSON.currency)) {

                    if (recordObj.type != "itemfulfillment") {

                        var bookLineCount = recordObj.getLineCount({ sublistId: "accountingbookdetail" });
                        if (bookLineCount != null && bookLineCount > 0) {
                            for (var i = 0; i < bookLineCount; i++) {
                                var bookCurrency = recordObj.getSublistValue({ sublistId: "accountingbookdetail", fieldId: "currency", line: i });
                                if (bookCurrency == STS_JSON.currency) {
                                    exchangeRate = recordObj.getSublistValue({ sublistId: "accountingbookdetail", fieldId: "exchangerate", line: i });
                                    break;
                                }
                            }
                        }

                    } else {

                        var bookSearch = search.create({
                            type: "transaction",
                            columns: [
                                "accountingTransaction.accountingbook",
                                "accountingTransaction.basecurrency",
                                "accountingTransaction.exchangerate"
                            ],
                            filters: [
                                [ "mainline", "IS", "T" ], "AND",
                                [ "internalid", "IS", recordObj.id ]
                            ],
                            settings: [
                                search.createSetting({ name: "consolidationtype", value: "NONE" })
                            ]
                        });

                        var bookSearchResult = bookSearch.run().getRange(0, 100);
                        if (bookSearchResult != null && bookSearchResult.length > 0) {
                            for (var i = 0; i < bookSearchResult.length; i++) {
                                var bookCurrency = bookSearchResult[i].getValue({ join: "accountingTransaction", name: "basecurrency" });
                                if (Number(bookCurrency) == Number(STS_JSON.currency)) {
                                    exchangeRate = bookSearchResult[i].getValue({ join: "accountingTransaction", name: "exchangerate" });
                                    break;
                                }
                            }
                        }

                    }

                } else { // La moneda de la subsidiaria es igual a la moneda del Setup Tax Subsidiary
                    exchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
                }

            } else { // No es OneWorld o no tiene MultiBook
                exchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
            }

            exchangeRate = parseFloat(exchangeRate);
            log.debug('[ exchangeRate ]', exchangeRate);
            return exchangeRate;

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
