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
], function (log, record, search, runtime, suiteAppInfo, Library_Log, Library_Mail) {

    var LMRY_Script = "LMRY BR ST Purchase Tax Transaction LBRY V2.0";
    var LMRY_script_Name = "LMRY_BR_ST_Purchase_Tax_Transaction_LBRY_V2.0.js";

    var FEATURE_SUBSIDIARY = false;
    var FEATURE_MULTIBOOK = false;

    var FEATURE_CUSTOMSEGMENTS = false;

    var FEATURE_DEPARTMENT = false;
    var FEATURE_CLASS = false;
    var FEATURE_LOCATION = false;

    var MANDATORY_DEPARTMENT = false;
    var MANDATORY_CLASS = false;
    var MANDATORY_LOCATION = false;

    var APPROVAL_JOURNAL = false;

    var NS_FA_ACTIVE = false;

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

                    FEATURE_CUSTOMSEGMENTS = runtime.isFeatureInEffect({ feature: "CUSTOMSEGMENTS" });

                    FEATURE_DEPARTMENT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
                    FEATURE_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
                    FEATURE_LOCATION = runtime.isFeatureInEffect({ feature: "LOCATIONS" });

                    MANDATORY_DEPARTMENT = runtime.getCurrentUser().getPreference({ name: "DEPTMANDATORY" });
                    MANDATORY_CLASS = runtime.getCurrentUser().getPreference({ name: "CLASSMANDATORY" });
                    MANDATORY_LOCATION = runtime.getCurrentUser().getPreference({ name: "LOCMANDATORY" });

                    APPROVAL_JOURNAL = runtime.getCurrentScript().getParameter({ name: "CUSTOMAPPROVALJOURNAL" });

                    var transactionSubsidiary = "";
                    if (FEATURE_SUBSIDIARY == true) {
                        transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
                    } else {
                        transactionSubsidiary = recordObj.getValue({ fieldId: "custbody_lmry_subsidiary_country" });
                    }

                    NS_FA_ACTIVE = _fixedAssetBundleActive(transactionSubsidiary);

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

                    var transactionVoided = recordObj.getValue({ fieldId: "voided" });
                    if (transactionVoided == true || transactionVoided == "T") {
                        return true;
                    }
                    var transactionCountry = recordObj.getText({ fieldId: "custbody_lmry_subsidiary_country" });
                    var transactionCountryID = recordObj.getValue({ fieldId: "custbody_lmry_subsidiary_country" });
                    var applyWHT = recordObj.getValue({ fieldId: "custbody_lmry_apply_wht_code" });
                    var transactionProvince = recordObj.getValue({ fieldId: "custbody_lmry_province" });
                    var transactionCity = recordObj.getValue({ fieldId: "custbody_lmry_city" });
                    var transactionDistrict = recordObj.getValue({ fieldId: "custbody_lmry_district" });
                    var transactionEntity = recordObj.getValue({ fieldId: "entity" });

                    var STS_JSON = _getSetupTaxSubsidiary(transactionSubsidiary);
                    var exchangeRate = _getExchangeRate(recordObj, STS_JSON);
                    var arrayDifalSubType = _getListOfDifalSubType();
                    var provinceRateJSON = _getJsonOfProviceRate();
                    var brTransactionFieldsJSON = _getBRTransactionFields(transactionID);
                    var CC_SearchResult = _getContributoryClasses(recordObj, filtroTransactionType, transactionSubsidiary);
                    var NT_SearchResult = _getNationalTaxes(recordObj, filtroTransactionType, transactionSubsidiary);

                    var hasProvince = false;
                    var hasProvOrigen = transactionProvince ? transactionProvince : brTransactionFieldsJSON.province;
                    if (hasProvOrigen && STS_JSON.br_province) {
                        hasProvince = true;
                    }

                    var matchDifal = false;
                    if ((STS_JSON.br_difal_obs) && (STS_JSON.br_difal_obs == brTransactionFieldsJSON.fiscalobs)) {
                        matchDifal = true;
                    }

                    var MVARecords = {};
                    var TaxesToSubstitutionTax = {};
                    var SubstitutionTaxes = {};
                    var TaxNotIncluded = {};

                    if (Number(STS_JSON.taxflow) == 4 && transactionType != "itemfulfillment") {
                        MVARecords = _getMVARecords(transactionSubsidiary);
                    }

                    var itemLineCount = recordObj.getLineCount({ sublistId: "item" });
                    var expenseLineCount = recordObj.getLineCount({ sublistId: "expense" });

                    var taxResult = [];
                    if (CC_SearchResult != null && CC_SearchResult.length > 0) {

                        for (var i = 0; i < CC_SearchResult.length; i++) {

                            var CC_InternalID = CC_SearchResult[i].getValue({ name: "internalid" });
                            var CC_GeneratedTransaction = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_gen_transaction" });
                            var CC_GeneratedTransactionID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_gen_transaction" });
                            var CC_Description = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_description" });
                            var CC_TaxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_taxtype" });
                            var CC_TaxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_taxtype" });
                            var CC_SubType = CC_SearchResult[i].getText({ name: "custrecord_lmry_sub_type" });
                            var CC_SubTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
                            var CC_TaxByLocation = CC_SearchResult[i].getValue({ join: "custrecord_lmry_sub_type", name: "custrecord_lmry_tax_by_location" });
                            var CC_ImportTax = CC_SearchResult[i].getValue({ join: "custrecord_lmry_sub_type", name: "custrecord_lmry_br_is_import_tax" });
                            var CC_TaxNotIncluded = CC_SearchResult[i].getValue({ join: "custrecord_lmry_sub_type", name: "custrecord_lmry_is_tax_not_included" });
                            var CC_STE_TaxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_ste_tax_type" });
                            var CC_STE_TaxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_cc_ste_tax_type" });
                            var CC_STE_TaxCode = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_ste_tax_code" });
                            var CC_STE_TaxCodeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_cc_ste_tax_code" });
                            var CC_TaxRule = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_tax_rule" });
                            var CC_TaxRuleID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_tax_rule" });
                            var CC_TaxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxrate" });
                            var CC_AmountTo = CC_SearchResult[i].getValue({ name: "custrecord_lmry_amount" });
                            var CC_AdditionalRatio = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_addratio" });
                            var CC_MinAmount = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_minamount" }) || 0.00;
                            var CC_MaxAmount = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_maxamount" }) || 0.00;
                            var CC_BaseRetention = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_set_baseretention" });
                            var CC_IsExempt = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_isexempt" });
                            var CC_BaseAmount = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_base_amount" });
                            var CC_NotTaxableMin = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_not_taxable_minimum" });
                            var CC_GlImpact = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_gl_impact" });
                            var CC_IsReduction = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_is_reduction" });
                            var CC_IsSubstitutionTax = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_is_substitution" });
                            var CC_TaxItem = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxitem" });
                            var CC_TaxCode = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxcode" });
                            var CC_Department = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_department" });
                            var CC_DepartmentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_department" });
                            var CC_Class = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_class" });
                            var CC_ClassID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_class" });
                            var CC_Location = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_location" });
                            var CC_LocationID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_location" });
                            var CC_CreditAccount = CC_SearchResult[i].getText({ name: "custrecord_lmry_br_ccl_account2" });
                            var CC_CreditAccountID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_ccl_account2" });
                            var CC_DebitAccount = CC_SearchResult[i].getText({ name: "custrecord_lmry_br_ccl_account1" });
                            var CC_DebitAccountID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_ccl_account1" });
                            var CC_TelecomunicationTax = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_exclusive" });
                            var CC_BR_Receita = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_receita" });
                            var CC_BR_TaxSituation = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_taxsituation" });
                            var CC_BR_Revenue = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_nature_revenue" });
                            var CC_BR_RegimenCatalog = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_ccl_regimen_catalog" });
                            var CC_TaxDifal = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_difal" }) || 0.00;
                            var CC_ApplyReport = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_br_apply_report" });
                            var CC_BR_TaxRateFA = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_fa_tax_rate" }) || 0.00;
                            var CC_ReductionRatio = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_reduction_ratio" }) || 1;

                            CC_TaxRate = parseFloat(CC_TaxRate);
                            CC_TaxDifal = parseFloat(CC_TaxDifal);
                            CC_BR_TaxRateFA = parseFloat(CC_BR_TaxRateFA);

                            if (Number(STS_JSON.taxflow) != 4) {
                                CC_ReductionRatio = 1;
                            }
                            // CONVERSION DE LOS MONTON DEL CC_SearchResult A MONEDA DE LA TRANSACCION
                            if (CC_MinAmount == null || CC_MinAmount == "") {
                                CC_MinAmount = 0;
                            }
                            CC_MinAmount = parseFloat(parseFloat(CC_MinAmount) / exchangeRate);

                            if (CC_MaxAmount == null || CC_MaxAmount == "") {
                                CC_MaxAmount = 0;
                            }
                            CC_MaxAmount = parseFloat(parseFloat(CC_MaxAmount) / exchangeRate);

                            if (CC_BaseRetention == null || CC_BaseRetention == "") {
                                CC_BaseRetention = 0;
                            }
                            CC_BaseRetention = parseFloat(parseFloat(CC_BaseRetention) / exchangeRate);

                            if (CC_NotTaxableMin == null || CC_NotTaxableMin == "") {
                                CC_NotTaxableMin = 0;
                            }
                            CC_NotTaxableMin = parseFloat(parseFloat(CC_NotTaxableMin) / exchangeRate);

                            if (CC_AdditionalRatio == null || CC_AdditionalRatio == "") {
                                CC_AdditionalRatio = 1;
                            }

                            if (CC_GlImpact && transactionType != "itemfulfillment") {
                                if ((CC_CreditAccountID == null || CC_CreditAccountID == "") || (CC_DebitAccountID == null || CC_DebitAccountID == "")) {
                                    continue;
                                }
                            }

                            if ((applyWHT == true || applyWHT == "T") && (CC_TaxByLocation == true || CC_TaxByLocation == "T")) {
                                continue;
                            }

                            if ((CC_ImportTax == true || CC_ImportTax == "T") && (transactionType != "itemfulfillment")) {

                                // Solo aplica para el flujo 3
                                if (Number(STS_JSON.taxflow) != 4) {
                                    continue;
                                }

                                // Se verifica si extranjero
                                var Entity_Country = search.lookupFields({
                                    type: "vendor",
                                    id: transactionEntity,
                                    columns: [ "custentity_lmry_country.custrecord_lmry_mx_country" ]
                                }).custentity_lmry_country.custrecord_lmry_mx_country;

                                if (!Entity_Country || !Entity_Country.length || Number(Entity_Country[0].value) == 30) {
                                    continue;
                                }

                            }

                            if (CC_TaxRule == null || CC_TaxRule == "") {
                                continue;
                            }

                            // Calculo de impuestos por líneas de item
                            if (itemLineCount != null && itemLineCount != "") {

                                for (var j = 0; j < itemLineCount; i++) {

                                    var itemName = recordObj.getSublistText({ sublistId: "item", fieldId: "item", line: j });
                                    var itemID = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: j });
                                    var lineUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: j });
                                    var itemDetailReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: j });
                                    var itemTaxRule = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_tax_rule", line: j });
                                    var itemRegimen = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_regimen", line: j });
                                    var itemMcnCode = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_tran_mcn", line: j });
                                    var itemIsTax = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_ar_item_tributo", line: j });

                                    var retencion = 0;
                                    var baseAmount = 0;
                                    var compareAmount = 0;

                                    if (itemIsTax == true || itemIsTax == "T") {
                                        continue;
                                    }

                                    var itemFixedAsset = "";
                                    if (NS_FA_ACTIVE == true || NS_FA_ACTIVE == "T") {
                                        var itemFixedAssetField = recordObj.getSublistField({ sublistId: "item", fieldId: "custcol_far_trn_relatedasset", line: j });
                                        if (itemFixedAssetField) {
                                            itemFixedAsset = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_far_trn_relatedasset", line: j }) || "";
                                        }
                                    } else {
                                        itemFixedAsset = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_fixed_assets", line: j }) || "";
                                    }

                                    var itemTaxSituation = 0;
                                    switch (CC_SubTypeID) {
                                        case "10": // PIS
                                            itemTaxSituation = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_cst_pis", line: j });
                                            break;
                                        case "11": // COFINS
                                            itemTaxSituation = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_cst_cofins", line: j });
                                            break;
                                        case "24": // ICMS
                                            itemTaxSituation = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_cst_icms", line: j });
                                            break;
                                        case "36": // IPI
                                            itemTaxSituation = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_cst_ipi", line: j });
                                            break;
                                    }

                                    if (CC_TaxRule != itemTaxRule) {
                                        continue;
                                    }

                                    if (itemRegimen == null || itemRegimen == "" || itemRegimen == 0) {
                                        itemRegimen = CC_BR_RegimenCatalog;
                                    }

                                    if (itemTaxSituation == null || itemTaxSituation == "" || itemTaxSituation == 0) {
                                        itemTaxSituation = CC_BR_TaxSituation;
                                    }

                                    if (Number(STS_JSON.taxflow) == 4 && transactionType != "itemfulfillment") {
                                        if (CC_IsSubstitutionTax == true || CC_IsSubstitutionTax == "T") {
                                            var MVA_List = _getMVAByValues(MVARecords, itemMcnCode, "", "", CC_SubTypeID, CC_TaxRate);
                                            if (MVA_List != null && MVA_List.length > 0) {
                                                for (var x = 0; x < MVA_List.length; x > 0) {
                                                    var MVA_Id = MVA_List[x].mva_id;
                                                    SubstitutionTaxes[j] = SubstitutionTaxes[j] || {};
                                                    SubstitutionTaxes[j][MVA_Id] = SubstitutionTaxes[j][MVA_Id] || [];
                                                    SubstitutionTaxes[j][MVA_Id].push({
                                                        subtype: CC_SubType,
                                                        subtypeid: CC_SubTypeID,
                                                        taxrate: parseFloat(CC_TaxRate),
                                                        mvarate:
                                                    })
                                                }
                                            }
                                        }
                                    }

                                } // Fin for itemLineCount

                            } // Fin if itemLineCount

                        }

                    } else { // Fin IF CC_SearchResult

                        if (NT_SearchResult != null && NT_SearchResult.length > 0) {



                        } // Fin IF NT_SearchResult

                    }

                }

            }

        } catch (e) {
            Library_Mail.sendemail('[ afterSubmit - setTaxTransaction ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ afterSubmit - setTaxTransaction ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que retorna valores del Record: "LatamReady BR - MVA" que es un
     *  JSON de valores del record, y hace ciertas validaciones y retorna un
     *  arreglo, el filtro es el campo MCN del item.
     ***************************************************************************/
    function _getMVAByValues(mvaRecords, itemMcnCode, subType, taxRate, substiSubType, substiTaxRate) {

        try {

            var mvaList = [];
            if (mvaRecords[itemMcnCode]) {
                var mvaRecord = mvaRecords[itemMcnCode];
                for (var i = 0; i < mvaRecord.length; i++) {
                    var MVA = mvaRecord[i];
                    var flag = true;

                    if ((subType) && (Number(MVA.mva_subtype) != Number(subType))) {
                        flag = false;
                    }

                    if ((taxRate) && (round4(MVA.mva_taxrate) != round4(taxRate))) {
                        flag = false;
                    }

                    if ((substiSubtype) && (Number(MVA.mva_substisubtype) != Number(substiSubtype))) {
                        flag = false;
                    }

                    if ((substiTaxRate) && (round4(MVA.mva_substitaxrate) != round4(substiTaxRate))) {
                        flag = false;
                    }

                    if (flag) {
                        mvaList.push(MVA);
                    }
                }
            }
            log.debug('[ mvaList ]', mvaList);
            return mvaList;

        } catch (e) {
            Library_Mail.sendemail('[ _getMVAByValues ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getMVAByValues ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hace un búsqueda en el Record "LatamReady BR - MVA"
     *  y retornar un JSON con datos del record
     ***************************************************************************/
    function _getMVARecords(transactionSubsidiary) {

        try {

            MVA_Columns = [
                search.createColumn({ name: "internalid", label: "Internal ID" }),
                search.createColumn({ name: "custrecord_lmry_br_mva_rate", label: "Latam - MVA AJUSTE" }),
                search.createColumn({ name: "custrecord_lmry_br_mva_ncm", label: "Latam - NCM CODE" }),
                search.createColumn({ name: "custrecord_lmry_br_mva_subtype", label: "Latam - IMPUESTO PROPIO" }),
                search.createColumn({ name: "custrecord_lmry_br_mva_taxrate", label: "LATAM - PORCENTAJE IMPUESTO PROPIO" }),
                search.createColumn({ name: "custrecord_lmry_br_mva_subtype_substi", label: "LATAM - IMPUESTO SUSTITUCIÓN" }),
                search.createColumn({ name: "custrecord_lmry_br_mva_taxrate_substi", label: "LATAM - PORCENTAJE IMPUESTO SUSTITUCIÓN" })
            ];

            var MVA_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: [ "F" ] })
            ];

            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                MVA_Filters.push(search.createFilter({ name: "custrecord_lmry_br_mva_subsidiary", operator: "ANYOF", values: transactionSubsidiary }));
            }

            var MVA_Search = search.create({
                type: "customrecord_lmry_br_mva",
                columns: MVA_Columns,
                filters: MVA_Filters
            }).run().getRange(0, 1000);

            var mvaRecords = {};
            if (MVA_Search != null && MVA_Search.length > 0) {
                for (var i = 0; i < MVA_Search.length; i++) {
                    var MVA_InternalID = MVA_Search[i].getValue({ name: "internalid" });
                    var MVA_Rate = MVA_Search[i].getValue({ name: "custrecord_lmry_br_mva_rate" });
                    var MVA_McnCode = MVA_Search[i].getValue({ name: "custrecord_lmry_br_mva_ncm" });
                    var MVA_SubType = MVA_Search[i].getValue({ name: "custrecord_lmry_br_mva_subtype" });
                    var MVA_TaxRate = MVA_Search[i].getValue({ name: "custrecord_lmry_br_mva_taxrate" });
                    var MVA_SubstiSubType = MVA_Search[i].getValue({ name: "custrecord_lmry_br_mva_subtype_substi" });
                    var MVA_SubstiTaxRate = MVA_Search[i].getValue({ name: "custrecord_lmry_br_mva_taxrate_substi" });

                    MVA_Rate = parseFloat(MVA_Rate) || 0.00;
                    MVA_TaxRate = parseFloat(MVA_TaxRate) || 0.00;
                    MVA_SubstiTaxRate = parseFloat(MVA_SubstiTaxRate) || 0.00;

                    mvaRecords[MVA_McnCode] = mvaRecords[MVA_McnCode] || [];
                    mvaRecords[MVA_McnCode].push({
                        mva_id: MVA_InternalID,
                        mva_rate: MVA_Rate,
                        mva_mcncode: MVA_McnCode,
                        mva_subtype: MVA_SubType,
                        mva_taxrate: MVA_TaxRate,
                        mva_substisubtype: MVA_SubstiSubType,
                        mva_substitaxrate: MVA_SubstiTaxRate
                    });
                }
            }
            log.debug('[ mvaRecords ]', mvaRecords);
            return mvaRecords;

        } catch (e) {
            Library_Mail.sendemail('[ _getMVARecords ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getMVARecords ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hará una búsqueda en el Record: "LatamReady - National
     *  Taxes". Del culál se va a recuperar los registros configurados para este
     *  proceso, según los filtros que se pongan
     *  Parámetros:
     *      - recordObj: Record de la transacción
     *      - filtroTransactionType: Tipor de la transaccion
     *      - transactionSubsidiary: Subsidiaria de la transaccion
     ***************************************************************************/
    function _getNationalTaxes(recordObj, filtroTransactionType, transactionSubsidiary) {

        try {

            var transactionDate = recordObj.getText({ fieldId: "trandate" });
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

            NT_Filters.push("AND", [
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
            log.debug('[ NT_Search ]', NT_Search);
            return NT_Search;

        } catch (e) {
            Library_Mail.sendemail('[ _getNationalTaxes ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getNationalTaxes ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hará una búsqueda en el Record: "LatamReady - Contributory
     *  Class". Del culál se va a recuperar los registros configurados para este
     *  proceso, según los filtros que se pongan
     *  Parámetros:
     *      - recordObj: Record de la transacción
     *      - filtroTransactionType: Tipor de la transaccion
     *      - transactionSubsidiary: Subsidiaria de la transaccion
     ***************************************************************************/
    function _getContributoryClasses(recordObj, filtroTransactionType, transactionSubsidiary) {

        try {

            var transactionDate = recordObj.getText({ fieldId: "trandate" });
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

            CC_Filters.push("AND", [
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
            log.debug('[ CC_Search ]', CC_Search);
            return CC_Search;

        } catch (e) {
            Library_Mail.sendemail('[ _getContributoryClasses ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getContributoryClasses ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hace un búsqueda en el Record "LatamReady - BR Transaction Fields"
     *  y retornar un JSON con datos del record
     ***************************************************************************/
    function _getBRTransactionFields(transactionID) {

        try {

            var brTransactionFieldsJSON = {};
            var BR_TF_Search = search.create({      // TF: Transaction Fields
                type: "customrecord_lmry_br_transaction_fields",
                columns: [ "custrecord_lmry_br_province_transaction", "custrecord_lmry_br_fiscal_observations" ],
                filters: [
                    [ "isinactive", "IS", "F" ], "AND",
                    [ "custrecord_lmry_br_related_transaction", "IS", transactionID ]
                ]
            }).run().getRange(0, 1000);

            if (BR_TF_Search != null || BR_TF_Search.length > 0) {
                for (var i = 0; i < BR_TF_Search.length; i++) {
                    var BR_TF_Province = BR_TF_Search[i].getValue({ name: "custrecord_lmry_br_province_transaction" });
                    var BR_TF_FiscalObservation = BR_TF_Search[i].getValue({ name: "custrecord_lmry_br_fiscal_observations" });
                    brTransactionFieldsJSON["province"] = BR_TF_Province;
                    brTransactionFieldsJSON["fiscalobs"] = BR_TF_FiscalObservation;
                }
            }
            log.debug('[ brTransactionFieldsJSON ]', brTransactionFieldsJSON);
            return brTransactionFieldsJSON;

        } catch (e) {
            Library_Mail.sendemail('[ _getBRTransactionFields ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getBRTransactionFields ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hace un búsqueda en el Record "LatamReady - BR Province Difal Rate"
     *  y retornar un JSON con datos del record
     ***************************************************************************/
    function _getJsonOfProviceRate() {

        try {

            var provinceRateJSON = {};
            var BR_PDR_Search = search.create({         // PDR: Province Difal Rate
                type: "customrecord_lmry_br_province_difal_rate",
                columns: [ "custrecord_lmry_br_difal_province", "custrecord_lmry_br_difal_percentage" ],
                filters: [
                    [ "isinactive", "IS", "F" ]
                ]
            }).run().getRange(0, 1000);

            if (BR_PDR_Search != null || BR_PDR_Search.length > 0) {
                for (var i = 0; i < BR_PDR_Search.length; i++) {
                    var BR_PDR_Province = BR_PDR_Search[i].getValue({ name: "custrecord_lmry_br_difal_province" });
                    var BR_PDR_Rate = BR_PDR_Search[i].getValue({ name: "custrecord_lmry_br_difal_percentage" });
                    provinceRateJSON[BR_PDR_Province] = parseFloat(BR_PDR_Rate);
                }
            }
            log.debug('[ provinceRateJSON ]', provinceRateJSON);
            return provinceRateJSON;

        } catch (e) {
            Library_Mail.sendemail('[ _getJsonOfProviceRate ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getJsonOfProviceRate ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hace un búsqueda en el Record "LatamReady - Setup WHT Sub Type"
     *  y retornar un arreglo de IDs con los registros que sean de Brasil y que
     *  el campo "Latam - BR DIFAL APPLIED?" esté marcado
     ***************************************************************************/
    function _getListOfDifalSubType() {

        try {

            var listOfDifal = [];
            var SubType_Search = search.create({
                type: "customrecord_lmry_ar_wht_type",
                columns: [ "internalid" ],
                filters: [
                    [ "isinactive", "IS", "F" ], "AND",
                    [ "custrecord_lmry_withholding_country", "IS", "30" ], "AND",
                    [ "custrecord_lmry_difal_applied", "IS", "T" ]
                ]
            }).run().getRange(0, 1000);

            if (SubType_Search != null && SubType_Search.length > 0 ) {
                for (var i = 0; i < SubType_Search.length; i++) {
                    listOfDifal.push(SubType_Search[i].getValue({ name: "internalid" }));
                }
            }
            log.debug('[ listOfDifal ]', listOfDifal);
            return listOfDifal;

        } catch (e) {
            Library_Mail.sendemail('[ _getListOfDifalSubType ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getListOfDifalSubType ]', message: e, relatedScript: LMRY_script_Name });
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
            Library_Mail.sendemail('[ _getExchangeRate ]: ' + e, LMRY_Script);
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
                STS_JSON["taxflow"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_ap_flow" });
                STS_JSON["br_province"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_province" });
                STS_JSON["br_difal_acc"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_difal_acct" });
                STS_JSON["br_difal_obs"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_difal_obs" });
                STS_JSON["br_min_tax_purch"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_minimum_purc" });
            }
            log.debug('[ STS_JSON ]', STS_JSON);
            return STS_JSON;

        } catch (e) {
            Library_Mail.sendemail('[ _getSetupTaxSubsidiary ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getSetupTaxSubsidiary ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función donde valida si el bundle de Fixed Asset está instalado en la
     *  instancia.
     *  Parámetros:
     *      - transactionSubsidiary: Subsidiaria de la transacción
     *      - licenses: Features activos por configuración de subsidiaria
     ***************************************************************************/
    function _fixedAssetBundleActive(transactionSubsidiary, licenses) {

        try {

            var nsAssetsActive = false;
            if (!licenses) {
                licenses = Library_Mail.getLicenses(transactionSubsidiary) || [];
            }

            if (!Library_Mail.getAuthorization(663, licenses)) {
                var bundleID = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_fixed_asset_bundled_id" });
                if (bundleID) {
                    nsAssetsActive = suiteAppInfo.isBundleInstalled({ bundleId: bundleID });
                }
            }
            log.debug('[ nsAssetsActive ]', nsAssetsActive);
            return (nsAssetsActive == true || nsAssetsActive == "T");

        } catch (e) {
            Library_Mail.sendemail('[ _fixedAssetBundleActive ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _fixedAssetBundleActive ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function _round2(num) {
        if (num >= 0) {
            return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-3) / 1e2);
        } else {
            return parseFloat(Math.round(parseFloat(num) * 1e2 - 1e-3) / 1e2);
        }
    }

    function _round4(num) {
        if (num >= 0) {
            return parseFloat(Math.round(parseFloat(num) * 1e4 + 1e-3) / 1e4);
        } else {
            return parseFloat(Math.round(parseFloat(num) * 1e4 - 1e-3) / 1e4);
        }
    }

    return {
        setTaxTransaction: setTaxTransaction
    };

});
