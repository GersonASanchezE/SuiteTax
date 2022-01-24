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

    var applyWHT = false;
    var arreglo_SumaBaseBR = [];
    var arreglo_IndiceBaseBR = [];
    var blnTaxCalculate = false;

    /***************************************************************************
     *  Función donde se hará el proceso de LatamTax Purchase el cual realiza
     *  el cálculo de impuesto según lo configurao.
     *  Parámetros:
     *      - context: Objeto JSON donde tiene el record y el tipo de acció
     *          a realizar (create, edit o copy).
     ***************************************************************************/
    function getTaxPurchase (recordObj, STS_JSON, difalActive, isPreview) {

        try {

            // var recordObj = context.newRecord;
            // var actionType = context.type;

            var transactionID = recordObj.id;
            var transactionType = recordObj.type;

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

                applyWHT = recordObj.getValue({ fieldId: "custbody_lmry_apply_wht_code" });

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
                var transactionProvince = recordObj.getValue({ fieldId: "custbody_lmry_province" });
                var transactionCity = recordObj.getValue({ fieldId: "custbody_lmry_city" });
                var transactionDistrict = recordObj.getValue({ fieldId: "custbody_lmry_district" });
                var transactionEntity = recordObj.getValue({ fieldId: "entity" });

                var exchangeRate = _getExchangeRate(recordObj, STS_JSON);
                var arrayDifalSubType = _getListOfDifalSubType();
                var provinceRateJSON = _getJsonOfProviceRate();
                var brTransactionFieldsJSON = _getBRTransactionFields(transactionID);
                var CC_SearchResult = _getContributoryClasses(recordObj, filtroTransactionType, transactionSubsidiary);
                var NT_SearchResult = _getNationalTaxes(recordObj, filtroTransactionType, transactionSubsidiary);

                var hasProvince = false;
                var hasProvOrigen = transactionProvince ? transactionProvince : brTransactionFieldsJSON.province;
                var br_tf_province = brTransactionFieldsJSON.province;
                if (hasProvOrigen && STS_JSON.province) {
                    hasProvince = true;
                }

                var matchDifal = false;
                if ((STS_JSON.fiscalobs) && (STS_JSON.fiscalobs == brTransactionFieldsJSON.fiscalobs)) {
                    matchDifal = true;
                }

                var MVARecords = {};
                var TaxesToSubstitutionTax = {};
                var SubstitutionTaxes = {};
                var TaxNotIncluded = {};

                if (Number(STS_JSON.taxFlow) == 4 && transactionType != "itemfulfillment") {
                    MVARecords = _getMVARecords(transactionSubsidiary);
                }

                var itemLineCount = recordObj.getLineCount({ sublistId: "item" });
                var expenseLineCount = recordObj.getLineCount({ sublistId: "expense" });

                var taxResults = [];
                var taxDetailLines = 0;
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
                        var CC_IsImportTax = CC_SearchResult[i].getValue({ join: "custrecord_lmry_sub_type", name: "custrecord_lmry_br_is_import_tax" });
                        var CC_IsTaxNotIncluded = CC_SearchResult[i].getValue({ join: "custrecord_lmry_sub_type", name: "custrecord_lmry_is_tax_not_included" });
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

                        if (Number(STS_JSON.taxFlow) != 4) {
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

                        if ((CC_IsImportTax == true || CC_IsImportTax == "T") && (transactionType != "itemfulfillment")) {

                            // Solo aplica para el flujo 3
                            if (Number(STS_JSON.taxFlow) != 4) {
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

                        if (CC_TaxRuleID == null || CC_TaxRuleID == "") {
                            continue;
                        }

                        // Calculo de impuestos por líneas de item
                        if (itemLineCount != null && itemLineCount != "") {

                            for (var j = 0; j < itemLineCount; j++) {

                                var itemName = recordObj.getSublistText({ sublistId: "item", fieldId: "item", line: j });
                                var itemID = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: j });
                                var itemUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: j });
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

                                if (CC_TaxRuleID != itemTaxRule) {
                                    continue;
                                }

                                if (itemRegimen == null || itemRegimen == "" || itemRegimen == 0) {
                                    itemRegimen = CC_BR_RegimenCatalog;
                                }

                                if (itemTaxSituation == null || itemTaxSituation == "" || itemTaxSituation == 0) {
                                    itemTaxSituation = CC_BR_TaxSituation;
                                }

                                if (Number(STS_JSON.taxFlow) == 4 && transactionType != "itemfulfillment") {
                                    if (CC_IsSubstitutionTax == true || CC_IsSubstitutionTax == "T") {
                                        var MVA_List = _getMVAByValues(MVARecords, itemMcnCode, "", "", CC_SubTypeID, CC_TaxRate);
                                        if (MVA_List != null && MVA_List.length > 0) {
                                            for (var x = 0; x < MVA_List.length; x > 0) {
                                                var MVA_Id = MVA_List[x].mva_id;
                                                var MVA_Rate = MVA_List[x].mva_rate;
                                                SubstitutionTaxes[j] = SubstitutionTaxes[j] || {};
                                                SubstitutionTaxes[j][MVA_Id] = SubstitutionTaxes[j][MVA_Id] || [];
                                                SubstitutionTaxes[j][MVA_Id].push({
                                                    subType: CC_SubType,
                                                    subTypeId: CC_SubTypeID,
                                                    taxRate: parseFloat(CC_TaxRate),
                                                    mvaRate: MVA_Rate,
                                                    taxRecordId: CC_InternalID,
                                                    case: "2I",
                                                    receita: CC_BR_Receita,
                                                    taxSituation: itemTaxSituation,
                                                    natureRevenue: CC_BR_Revenue,
                                                    regime: itemRegimen,
                                                    taxItem: CC_TaxItem,
                                                    taxCode: CC_TaxCode,
                                                    faTaxRate: CC_BR_TaxRateFA
                                                });
                                            }
                                        }
                                        continue;
                                    }
                                }

                                if (transactionType != "itemfulfillment") {
                                    var itemGrossAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "grossamt", line: j }) || 0.00;
                                    var itemTaxAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxamount", line: j }) || 0.00;
                                    var itemNetAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j }) || 0.00;
                                } else {
                                    var itemQuantity = recordObj.getSublistValue({ sublistId: "item", fieldId: "quantity", line: j });
                                    var itemRate = recordObj.getSublistValue({ sublistId: "item", fieldId: "rate", line: j });
                                    var itemGrossAmount = _round2(parseFloat(itemQuantity) * parseFloat(itemRate));
                                    var itemNetAmount = itemGrossAmount;
                                    var itemTaxAmount = 0.00;
                                 }

                                 if (itemTaxAmount == 0 && CC_AmountTo == 2) {      //taxamount es 0 y aplica al Tax Amount
                                     continue;
                                 }

                                 var baseDifal = 0;
                                 var baseFixedAsset = 0;
                                 if (STS_JSON.taxFlow == 1 || STS_JSON.taxFlow == 3) { // Para los flujos 0 y 2
                                     CC_AmountTo = 3 // Trabaja siempre con el Net Amount
                                     var sumOfTaxes = parseFloat(_getSumOfTaxes(CC_SearchResult, "custrecord_lmry_ar_ccl_taxrate", "custrecord_lmry_br_ccl_rate_suma", "custrecord_lmry_ccl_tax_rule", itemTaxRule, "custrecord_lmry_sub_type"));
                                     itemNetAmount = parseFloat(itemNetAmount / parseFloat(1 - sumOfTaxes));
                                     itemTaxAmount = parseFloat(itemTaxAmount / parseFloat(1 - sumOfTaxes));
                                     itemGrossAmount = parseFloat(itemGrossAmount / parseFloat(1 - sumOfTaxes));

                                     if (CC_TelecomunicationTax == true || CC_TelecomunicationTax == "T") { // En el caso de un impuesto de Telecomunicación (FUST o FUNTTEL)
                                         var sumaBaseCalculoI = _baseCalculationBR(0, j, false);
                                         // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                                         itemNetAmount = parseFloat(itemNetAmount) - parseFloat(sumaBaseCalculoI);
                                         itemTaxAmount = parseFloat(itemTaxAmount) - parseFloat(sumaBaseCalculoI);
                                         itemGrossAmount = parseFloat(itemGrossAmount) - parseFloat(sumaBaseCalculoI);
                                     }
                                 } else { // Para los flujos 1 y 3
                                     CC_AmountTo = 1; // Trabaja siempre con el Gross Amount
                                     if (STS_JSON.taxFlow == 4) {
                                         baseDifal = itemGrossAmount;
                                         baseFixedAsset = itemGrossAmount;
                                         if (CC_TelecomunicationTax == true || CC_TelecomunicationTax == "T") { // En el caso de un impuesto de Telecomunicación (FUST o FUNTTEL)
                                             var sumaBaseCalculoI = _baseCalculationBR(0, j, false);
                                             // Si es un impuesto de telecomunicaciones se resta al gross(monto base), la suma de los otros impuestos(PIS, COFINS..)
                                             itemGrossAmount = parseFloat(itemGrossAmount) - parseFloat(sumaBaseCalculoI);
                                         }
                                     }
                                 }

                                 // Cálculo del monto base
                                 switch (CC_AmountTo) {
                                     case 1:
                                        baseAmount = parseFloat(itemGrossAmount) - parseFloat(CC_NotTaxableMin);
                                        break;
                                     case 2:
                                        baseAmount = parseFloat(itemTaxAmount) - parseFloat(CC_NotTaxableMin);
                                        break;
                                    case 3:
                                        baseAmount = parseFloat(itemNetAmount) - parseFloat(CC_NotTaxableMin);
                                        break;
                                 }

                                 compareAmount = parseFloat(baseAmount);
                                 if (CC_BaseAmount != null && CC_BaseAmount != "") {
                                     switch (CC_BaseAmount) {
                                         case "2": // Substrac Minimun
                                            baseAmount = parseFloat(baseAmount) - parseFloat(CC_MinAmount);
                                            break;
                                         case "3": // Minimum
                                            baseAmount = parseFloat(CC_MinAmount);
                                            break;
                                        case "4": // Maximum
                                            baseAmount = parseFloat(CC_MaxAmount);
                                            break;
                                        case "5": // Always Substrac Minimum
                                            baseAmount = parseFloat(baseAmount) - parseFloat(CC_MinAmount);
                                            break;
                                     }
                                 }

                                 var originBaseAmount = parseFloat(baseAmount);
                                 if ((CC_TelecomunicationTax == false || CC_TelecomunicationTax == "F") && (CC_ReductionRatio != 1)) {
                                     baseAmount = baseAmount * CC_ReductionRatio;
                                     baseAmount = _round2(baseAmount);
                                 }

                                 if (baseAmount <= 0) {
                                     continue;
                                 }

                                 // Calculo de retencion
                                 if (CC_MaxAmount != 0) {
                                     if ((CC_MinAmount <= parseFloat(compareAmount)) && (parseFloat(compareAmount) <= CC_MaxAmount)) {
                                         retencion = (parseFloat(CC_TaxRate) * parseFloat(baseAmount) * parseFloat(CC_AdditionalRatio)) + parseFloat(CC_BaseRetention);
                                     }
                                 } else {
                                     if (CC_MinAmount <= parseFloat(compareAmount)) {
                                         retencion = (parseFloat(CC_TaxRate) * parseFloat(baseAmount) * parseFloat(CC_AdditionalRatio)) + parseFloat(CC_BaseRetention);
                                     }
                                 }

                                 if (parseFloat(retencion) > 0 || CC_IsExempt == true || parseFloat(CC_TaxRate) == 0) {

                                     var auxRetencion = _round2(retencion);
                                     if (parseFloat(retencion) > 0 || CC_IsExempt == true || parseFloat(CC_TaxRate) == 0) {

                                         var telecommTaxesFlows = [1, 3, 4]; // Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                                         // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0, 2, 3
                                         if ((CC_TelecomunicationTax == false || CC_TelecomunicationTax == "F") && (telecommTaxesFlows.indexOf(STS_JSON.taxflow) != -1)) {
                                             _baseCalculationBR(parseFloat(retencion), j, true);
                                         }

                                         var baseNoTributada = 0;
                                         var baseNoTributadaLC = 0;
                                         if ((CC_TelecomunicationTax == false || CC_TelecomunicationTax == "F") && (CC_IsReduction == true || CC_IsReduction == "T")) {
                                             baseNoTributada = _round2(originBaseAmount - baseAmount);
                                             if (exchangeRate == 1) {
                                                 baseNoTributadaLC = baseNoTributada;
                                             } else {
                                                 baseNoTributadaLC = (_round2(originBaseAmount) * exchRate) - (_round2(baseAmount) * exchangeRate)
                                             }
                                         }

                                         var difalAmount = 0.00, difalFxAmount = 0.00, faTaxAmount = 0.00;
                                         var difalOrigenRate = "", difalDestinationRate = "", difalAmountAuto = 0.00;
                                         if (Number(STS_JSON.taxFlow) == 4) {
                                             if (difalActive) {
                                                 if (hasProvince && arrayDifalSubType.indexOf(CC_SubTypeID) != -1 && matchDifal && STS_JSON.difalAccount) {
                                                     difalOrigenRate = transactionProvince ? provinceRateJSON[transactionProvince]: provinceRateJSON[br_tf_province];
                                                     difalDestinationRate = provinceRateJSON[STS_JSON.province];
                                                     var oriAmt = (baseDifal * difalOrigenRate) / 100;
                                                     oriAmt = Math.round(oriAmt * 100) / 100;
                                                     var desAmt = (baseDifal * difalDestinationRate) / 100;
                                                     desAmt = Math.round(desAmt * 100) / 100;
                                                     difalAmountAuto = Math.abs(oriAmt - desAmt);
                                                     if (exchangeRate != 1) {
                                                         difalAmountAuto = _round2(difalAmountAuto) * exchangeRate;
                                                     }
                                                     log.debug('[ Difal Data ]', [difalOrigenRate, difalDestinationRate, oriAmt, desAmt, difalAmountAuto].join('|'));
                                                     var originAmt = (baseDifal * difalOrigenRate) / 100;
                                                     var destinationAmt = (baseDifal * difalDestinationRate) / 100;
                                                     if (!isPreview) {
                                                         _createDifalJournal(originAmt, destinationAmt, STS_JSON, recordObj, CC_SubTypeID, j);
                                                     }
                                                 }
                                             } else {
                                                 if (CC_TaxDifal) {
                                                     difalFxAmount = parseFloat(baseDifal) * CC_TaxDifal;
                                                     difalAmount = difalFxAmount;
                                                     if (exchangeRate != 1) {
                                                         difalAmount = _round2(difalAmount) * exchangeRate;
                                                     }
                                                 }
                                             }

                                             if (CC_BR_TaxRateFA && itemFixedAsset) {
                                                 faTaxAmount = parseFloat(baseFixedAsset) * CC_BR_TaxRateFA;
                                                 if (exchangeRate != 1) {
                                                     faTaxAmount = _round2(faTaxAmount) * exchangeRate;
                                                 }
                                             }

                                             if (CC_IsSubstitutionTax == false || CC_IsSubstitutionTax == "F") {
                                                 var mvaList = _getMVAByValues(MVARecords, itemMcnCode, CC_SubTypeID, CC_TaxRate);
                                                 if (mvaList.length) {
                                                     TaxesToSubstitutionTax[j] = TaxesToSubstitutionTax[j] || {};
                                                     for (var m = 0; m < mvaList.length; m++) {
                                                         var mvaID = mvaList[m].mva_id;
                                                         var mvaRate = mvaList[m].mva_rate;
                                                         TaxesToSubstitutionTax[j][mvaID] = TaxesToSubstitutionTax[j][mvaID] || [];
                                                         TaxesToSubstitutionTax[j][mvaID].push({
                                                             mvaRate: mvaRate,
                                                             subType: CC_SubTypeID,
                                                             taxRate: parseFloat(CC_TaxRate),
                                                             taxRecordId: CC_InternalID
                                                         });
                                                     }
                                                 }
                                             }

                                             if (CC_IsTaxNotIncluded == true || CC_IsTaxNotIncluded == "T") {
                                                 TaxNotIncluded[j] = TaxNotIncluded[j] || {};
                                                 if (!TaxNotIncluded[j][CC_SubTypeID]) {
                                                     TaxNotIncluded[j][CC_SubTypeID] = {
                                                         amount: 0.00,
                                                         subType: CC_SubType,
                                                         subTypeId: CC_SubTypeID
                                                     };
                                                 }
                                                 TaxNotIncluded[j][CC_SubTypeID].amount += retencion;
                                             }
                                         }

                                         taxResults[j] = taxResults[j] || [];
                                         taxResults[j].push({
                                            subType: CC_SubType,
                                            subTypeID: CC_SubTypeID,
                                            lineUniqueKey: itemUniqueKey,
                                            baseAmount: parseFloat(baseAmount),
                                            retencion: parseFloat(retencion),
                                            idCCNT: CC_InternalID,
                                            taxRate: parseFloat(CC_TaxRate),
                                            caso: "2I",
                                            account1: CC_DebitAccountID,
                                            accoun2: CC_CreditAccountID,
                                            items: itemID,
                                            itemsName: itemName,
                                            posicionItem: j,
                                            description: CC_Description,
                                            receita: CC_BR_Receita,
                                            taxSituation: itemTaxSituation,
                                            natureRevenue: CC_BR_Revenue,
                                            regimen: itemRegimen,
                                            isExempt: CC_IsExempt,
                                            localCurrBaseAmt: exchangeRate == 1 ? parseFloat(baseAmount) : _round2(parseFloat(baseAmount)) * exchangeRate,
                                            localCurrAmt: exchangeRate == 1 ? retencion : _round2(retencion) * exchangeRate,
                                            localCurrGrossAmt: exchangeRate == 1 ? itemGrossAmount : _round2(itemGrossAmount) * exchangeRate,
                                            difalAmount: difalAmount,
                                            difalTaxRate: CC_TaxDifal,
                                            difalFxAmount: _round4(difalFxAmount),
                                            isApplyReport: CC_ApplyReport,
                                            isImportTax: CC_IsImportTax,
                                            baseNoTributada: baseNoTributada,
                                            baseNoTributadaLocCurr: baseNoTributadaLC,
                                            isSubstitutionTax: false,
                                            isTaxNotIncluded: CC_IsTaxNotIncluded,
                                            taxItem: CC_TaxItem,
                                            taxCode: CC_TaxCode,
                                            difalOrigen: difalOrigenRate,
                                            difalDestination: difalDestinationRate,
                                            difalAmountauto: difalAmountAuto,
                                            faTaxRate: CC_BR_TaxRateFA,
                                            faTaxAmount: faTaxAmount,
                                            fixedAsset: (CC_BR_TaxRateFA && !NS_FA_ACTIVE) ? fixedAsset : "",
                                            fixedAssetNS: (CC_BR_TaxRateFA && NS_FA_ACTIVE) ? fixedAsset : "",
                                            taxdetails: {
                                                detailReference: itemDetailReference,
                                                taxType: CC_STE_TaxTypeID,
                                                taxCode: CC_STE_TaxCodeID,
                                                taxBasis: baseAmount,
                                                taxRate: parseFloat(CC_TaxRate),
                                                taxAmount: Math.round((parseFloat(baseAmount) * parseFloat(CC_TaxRate)) * 100) / 100
                                            }
                                         });

                                         taxDetailLines += 1;
                                         blnTaxCalculate = true;

                                     }

                                 } // Fin retencion > 0

                            } // Fin for itemLineCount

                        } // Fin if itemLineCount

                    }

                } else { // Fin IF CC_SearchResult

                    if (NT_SearchResult != null && NT_SearchResult.length > 0) {



                    } // Fin IF NT_SearchResult

                }

            }

            // if (STS_JSON.taxFlow == 4 && transactionType != "itemfulfillment") {
            //     log.debub('[ TaxesToSubstitutionTax ]', TaxesToSubstitutionTax);
            //     log.debug('[ SubstitutionTaxes ]', SubstitutionTaxes);
            //     log.debug('[ taxesNotIncluded ]', taxesNotIncluded);
            //     _calculateSubstitutionTaxes(recordObj, TaxesToSubstitutionTax, SubstitutionTaxes, TaxNotIncluded, taxResults, exchangeRate);
            // }

            return taxResults;

        } catch (e) {
            Library_Mail.sendemail('[ getTaxPurchase ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ getTaxPurchase ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function _calculateSubstitutionTaxes(recordObj, taxesToST, stTaxes, taxesNotIncluded, taxResults, exchangeRate) {

        try {

            var itemLineCount = recordObj.getLineCount({ sublistId: "item" });
            if (itemLineCount != null && itemLineCount > 0) {
                for (var i = 0; i < itemLineCount; i++) {

                    var itemName = recordObj.getSublistText({ sublistId: "item", fieldId: "item", line: i });
                    var itemID = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
                    var itemUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: i });
                    var itemDetailReference = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: i });

                    var itemGrossAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "grossamt", line: i });
                    itemGrossAmount = parseFloat(itemGrossAmount);

                    var fixedAsset = "";
                    if (NS_FA_ACTIVE == true || NS_FA_ACTIVE == "T") {
                        var faNSField = recordObj.getSublistField({ sublistId: "item", fieldId: "custcol_far_trn_relatedasset", line: i });
                        if (faNSField) {
                            fixedAsset = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_far_trn_relatedasset", line: i });
                        }
                    } else {
                        fixedAsset = recordObj.getSublistField({ sublistId: "item", fieldId: "custcol_lmry_br_fixed_assets", line: i });
                    }

                    if (taxesToST[i]) {

                        var totalTaxesNotIncluded = 0.00;
                        if (taxesNotIncluded[i]) {
                            for (var taxNotIncluded in taxesNotIncluded[i]) {
                                totalTaxesNotIncluded += taxesNotIncluded[i][taxNotIncluded].amount;
                            }
                        }

                        for (var mvaID in taxesToST[i]) {
                            for (var j = 0; i < taxesToST[i][mvaID].length; j++) {

                                var mvaTax = taxesToST[i][mvaID][j];
                                var mvaTaxRate = mvaTax.mva_taxrate;

                            }
                        }

                    }

                }
            }

        } catch (e) {
            Library_Mail.sendemail('[ _calculateSubstitutionTaxes ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _calculateSubstitutionTaxes ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     * Funcion que realiza la sumatoria de los Impuestos No Excluyentes para la
     * formula del Monto Base de los Impuestos Excluyentes (Pais: Brasil)
     * Parámetros :
     *      originAmt: Monto de origen
     *      destinationAmt: Monto de destino
     *      STS_JSON: JSON con valores el Setup Tax Subsidiary
     *      recordObj: Transaccion
     *      subTypeID: ID del Sub Type del CC o NT
     *      position: Posicion de la linea del item o expense
     **************************************************************************/
    function _createDifalJournal(originAmt, destinationAmt, STS_JSON, recordObj, subTypeID, position) {

        try {

            originAmt = Math.round(originAmt * 100) / 100;
            destinationAmt = Math.round(destinationAmt * 100) / 100;

            // Campos de cabacera de la transaccion
            var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
            var transactionDate = recordObj.getValue({ fieldId: "trandate" });
            var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
            var transactionExchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
            var transactionAccount = recordObj.getValue({ fieldId: "account" });

            // Campos de lineas del item
            var itemDepartment = recordObj.getSublistValue({ sublistId: "item", fieldId: "department", line: position });
            var itemClass = recordObj.getSublistValue({ sublistId: "item", fieldId: "class", line: position });
            var itemLocation = recordObj.getSublistValue({ sublistId: "item", fieldId: "location", line: position });
            var itemAdjustOrigin = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_adjust_origin", line: position });
            var itemUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: position });

            // Creacion de un Journal Entry
            var newJournalRecord = record.create({
                tyoe: record.Type.JOURNAL_ENTRY,
                isDynamic: true
            });

            if (STS_JSON.formJournal) {
                newJournalRecord.setValue({ fieldId: "customform", value: STS_JSON.formJournal });
            }

            newJournalRecord.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });
            newJournalRecord.setValue({ fieldId: "trandate", value: transactionDate });
            newJournalRecord.setValue({ fieldId: "custbody_lmry_reference_transaction", value: recordObj.id });
            newJournalRecord.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: recordObj.id });
            newJournalRecord.setValue({ fieldId: "custbody_lmry_type_concept", value: 23 });
            newJournalRecord.setValue({ fieldId: "currency", value: transactionCurrency });
            newJournalRecord.setValue({ fieldId: "exchangerate", value: transactionExchangeRate });
            newJournalRecord.setValue({ fieldId: "memo", value: "DIFAL Transaction " + recordObj.id });

            // Debit Line (Origin)
            newJournalRecord.selectNewLine({ sublistId: "line" });
            newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: transactionAccount });
            newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "debit", value: originAmt });
            newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_br_tax", value: subTypeID });
            if ((MANDATORY_DEPARTMENT) && (itemDepartment)) {
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: itemDepartment });
            }
            if ((MANDATORY_CLASS) && (itemClass)) {
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: itemClass });
            }
            if ((MANDATORY_LOCATION) && (itemLocation)) {
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: itemLocation });
            }
            if (itemAdjustOrigin) {
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_adjust_origin", value: itemAdjustOrigin });
            }
            newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_item_posicion", value: itemUniqueKey });
            newJournalRecord.commitLine({ sublistId: "line" });

            // Credit Line (Destination)
            newJournalRecord.selectNewLine({ sublistId: "line" });
            newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: transactionAccount });
            newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "credit", value: originAmt });
            newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_br_tax", value: subTypeID });
            if ((MANDATORY_DEPARTMENT) && (itemDepartment)) {
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: itemDepartment });
            }
            if ((MANDATORY_CLASS) && (itemClass)) {
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: itemClass });
            }
            if ((MANDATORY_LOCATION) && (itemLocation)) {
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: itemLocation });
            }
            if (itemAdjustOrigin) {
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_adjust_origin", value: itemAdjustOrigin });
            }
            newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_item_posicion", value: itemUniqueKey });
            newJournalRecord.commitLine({ sublistId: "line" });

            // DIFAL
            var difalAmt =  Math.round((originAmt - destinationAmt) * 100) / 100;
            if (difalAmt > 0) {
                newJournalRecord.selectNewLine({ sublistId: "line" });
                newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: transactionAccount });
                if (originAmt > destinationAmt) {
                    newJournalRecord.setSublistValue({ sublistId: "line", fieldId: "credit", value: difalAmt });
                } else {
                    newJournalRecord.setSublistValue({ sublistId: "line", fieldId: "debit", value: difalAmt });
                }
                if ((MANDATORY_DEPARTMENT) && (itemDepartment)) {
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: itemDepartment });
                }
                if ((MANDATORY_CLASS) && (itemClass)) {
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: itemClass });
                }
                if ((MANDATORY_LOCATION) && (itemLocation)) {
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: itemLocation });
                }
            }

            if (APPROVAL_JOURNAL == true || APPROVAL_JOURNAL == "T") {
                newJournalRecord.setValue({ fieldId: "approvalstatus", value: 2 });
            }

            newJournalRecord.save({
                ignoreMandatoryFields: true,
                disableTriggers: true,
                enableSourcing: true
            });

            return true;

        } catch (e) {
            Library_Mail.sendemail('[ _createDifalJournal ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _createDifalJournal ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     * Funcion que realiza la sumatoria de los Impuestos No Excluyentes para la
     * formula del Monto Base de los Impuestos Excluyentes (Pais: Brasil)
     * Parámetros :
     *      retencionBR: impuesto calculado
     *      itemLine: línea del item
     *      flag: False: Impuesto Excluyente , True: Impuesto no Excluyente
     **************************************************************************/
    function _baseCalculationBR(retencionBR, itemLine, flag) {

        try {

            if (arreglo_IndiceBaseBR.length > 0) {
                for (var i = 0; i < arreglo_IndiceBaseBR.length; i++) {
                    if (arreglo_IndiceBaseBR[i] == itemLine) {
                        if (flag == true) { // Inserta la sumatoria de los No Excluyentes
                            arreglo_SumaBaseBR[i] = parseFloat(arreglo_SumaBaseBR[i]) + parseFloat(retencionBR);
                            return 0;
                        } else { // Obtiene la suma de los No Excluyentes almancedo
                            return arreglo_SumaBaseBR[i];
                        }
                    }
                }
            }

            arreglo_IndiceBaseBR.push(itemLine);
            arreglo_SumaBaseBR.push(parseFloat(retencionBR));

            return 0;

        } catch (e) {
            Library_Mail.sendemail('[ _baseCalculationBR ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _baseCalculationBR ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hace la suma de porcentajes de los impuestos que se hayan
     *  configurado por Contributory Class o National Tax
     *  Parámetros:
     *      - CC_NT_SearchResult: Búsqueda del CC o NT
     *      - taxRateID: ID del campo Tax Rate del CC o NT
     *      - sumTaxRateID: ID del campo Suma Tax Rate del CC o NT
     *      - taxRuleID: ID del campo Tax Rule del CC o NT
     *      - itemTaxRule: Tax Rule de la línea del Item
     *      - taxSubTypeID: ID del campo SubType del CC o NT
     ***************************************************************************/
    function _getSumOfTaxes(CC_NT_SearchResult, taxRateID, sumTaxRateID, taxRuleID, itemTaxRule, taxSubTypeID) {

        try {

            var sumOfTaxes = 0.00;
            for (var i = 0; i < CC_NT_SearchResult.length; i++) {

                var taxRate = CC_NT_SearchResult[i].getValue({ name: taxRateID });
                var sumtaxRate = CC_NT_SearchResult[i].getValue({ name: sumTaxRateID });
                var isTaxByLocation = CC_NT_SearchResult[i].getValue({ name: "custrecord_lmry_tax_by_location", join: taxSubTypeID });
                var taxRule = CC_NT_SearchResult[i].getValue({ name: taxRuleID });

                if ((isTaxByLocation == true || isTaxByLocation == "T") && (applyWHT == true || applyWHT == "T")) {
                    continue;
                }

                if (sumtaxRate != null && sumtaxRate == "") {
                    sumOfTaxes = parseFloat(sumtaxRate) / 100;
                }

                if (taxRule != null && taxRule != "" && taxRule == itemTaxRule) {
                    sumOfTaxes += parseFloat(taxRate);
                }

            }
            log.debug('[ _getSumOfTaxes ]', sumOfTaxes);
            return sumOfTaxes;

        } catch (e) {
            Library_Mail.sendemail('[ _getSumOfTaxes ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getSumOfTaxes ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que retorna valores del Record: "LatamReady BR - MVA" que es un
     *  JSON de valores del record, y hace ciertas validaciones y retorna un
     *  arreglo, el filtro es el campo MCN del item.
     *  Parámetros:
     *      - mvaRecords: JSON de datos del record "LatamReady BR - MVA"
     *      - itemMcnCode: Código MCN de la línea de transacción
     *      - subType: Impuestos
     *      - taxRate: Porcentaje del impuesto
     *      - substiSubtype: Impuesto sustituto
     *      - substiTaxRate: Porcenta de impuesto sustituto
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

                    if ((taxRate) && (_round4(MVA.mva_taxrate) != _round4(taxRate))) {
                        flag = false;
                    }

                    if ((substiSubtype) && (Number(MVA.mva_substisubtype) != Number(substiSubtype))) {
                        flag = false;
                    }

                    if ((substiTaxRate) && (_round4(MVA.mva_substitaxrate) != _round4(substiTaxRate))) {
                        flag = false;
                    }

                    if (flag) {
                        mvaList.push(MVA);
                    }
                }
            }
            log.debug('[ _getMVAByValues ]', mvaList);
            return mvaList;

        } catch (e) {
            Library_Mail.sendemail('[ _getMVAByValues ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getMVAByValues ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función que hace un búsqueda en el Record "LatamReady BR - MVA"
     *  y retornar un JSON con datos del record
     *  Parámetros:
     *      - transactionSubsidiary: Subsidiria de la transaccion
     ***************************************************************************/
    function _getMVARecords(transactionSubsidiary) {

        try {

            var MVA_Columns = [
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
            log.debug('[ _getMVARecords ]', mvaRecords);
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
            log.debug('[ _getNationalTaxes ]', NT_Search);
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
            log.debug('[ _getContributoryClasses ]', CC_Search);
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

            if (BR_TF_Search != null && BR_TF_Search.length > 0) {
                for (var i = 0; i < BR_TF_Search.length; i++) {
                    var BR_TF_Province = BR_TF_Search[i].getValue({ name: "custrecord_lmry_br_province_transaction" });
                    var BR_TF_FiscalObservation = BR_TF_Search[i].getValue({ name: "custrecord_lmry_br_fiscal_observations" });
                    brTransactionFieldsJSON["province"] = BR_TF_Province;
                    brTransactionFieldsJSON["fiscalobs"] = BR_TF_FiscalObservation;
                }
            }
            log.debug('[ _getBRTransactionFields ]', brTransactionFieldsJSON);
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

            if (BR_PDR_Search != null && BR_PDR_Search.length > 0) {
                for (var i = 0; i < BR_PDR_Search.length; i++) {
                    var BR_PDR_Province = BR_PDR_Search[i].getValue({ name: "custrecord_lmry_br_difal_province" });
                    var BR_PDR_Rate = BR_PDR_Search[i].getValue({ name: "custrecord_lmry_br_difal_percentage" });
                    provinceRateJSON[BR_PDR_Province] = parseFloat(BR_PDR_Rate);
                }
            }
            log.debug('[ _getJsonOfProviceRate ]', provinceRateJSON);
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
            log.debug('[ _getListOfDifalSubType ]', listOfDifal);
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
            log.debug('[_getExchangeRate ]', exchangeRate);
            return exchangeRate;

        } catch (e) {
            Library_Mail.sendemail('[ _getExchangeRate ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getExchangeRate ]', message: e, relatedScript: LMRY_script_Name });
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
            log.debug('[ _fixedAssetBundleActive ]', nsAssetsActive);
            return (nsAssetsActive == true || nsAssetsActive == "T");

        } catch (e) {
            Library_Mail.sendemail('[ _fixedAssetBundleActive ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _fixedAssetBundleActive ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función donde se realizará un búsqueda para recuperar la configuración
     *  de la subsidiaria en el Record: "LatamReady - Setup Tax Subsidiary"
     *  Parámetros:
     *      - transactionSubsidiary: Subsidiaria del cual se va a recuperar su
     *          configuración
     ***************************************************************************/
    function getSetupTaxSubsidiary(transactionSubsidiary) {

        try {

            FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

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
                search.createColumn({ name: "custrecord_lmry_setuptax_br_minimum_purc", label: "Latam - BR Minimum Tax Purchase" }),
                search.createColumn({ name: "custrecord_lmry_setuptax_br_tax_code", label: "Latam - BR Tax Code" }),
                search.createColumn({ name: "custrecord_lmry_ste_setup_tax_type", join: "custrecord_lmry_setuptax_br_tax_code" })

            ];

            var STS_Filters = [
                search.createFilter({ name: "isinactive", operator: "IS", values: ["F"] })
            ];
            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                STS_Filters.push(search.createFilter({ name: "custrecord_lmry_setuptax_subsidiary", operator: "IS", values: [transactionSubsidiary] }));
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
                STS_JSON["segmentacion"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_depclassloc" });
                STS_JSON["department"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_department" });
                STS_JSON["class"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_class" });
                STS_JSON["location"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_location" });
                STS_JSON["formBill"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_bill" });
                STS_JSON["formCredit"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_credit" });
                STS_JSON["formJournal"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_form_journal" });
                STS_JSON["taxFlow"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_ap_flow" });
                STS_JSON["province"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_province" });
                STS_JSON["difalAccount"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_difal_acct" });
                STS_JSON["fiscalobs"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_difal_obs" });
                STS_JSON["minimumTax"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_minimum_purc" });
                STS_JSON["taxCode"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_setuptax_br_tax_code" });
                STS_JSON["taxType"] = STS_SearchResult[0].getValue({ name: "custrecord_lmry_ste_setup_tax_type", join: "custrecord_lmry_setuptax_br_tax_code" });
            }
            log.debug('[ getSetupTaxSubsidiary ]', STS_JSON);
            return STS_JSON;

        } catch (e) {
            Library_Mail.sendemail('[ getSetupTaxSubsidiary ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ getSetupTaxSubsidiary ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Función para actualizar campos a nivel de linea del item y también
     *  permite agregar las nuevas lienas en el subtab de los tax details
     *  Parámetros:
     *      - taxResults: JSON con datos de los impuestos y transaccion
     *      - recordObj: Record al cual se le aplicarán los impuestos
     *      - position: Posicion de la linea del item
     *      - STS_JSON: Datos del Setupt Tax Subsidiary
     *      - licenses: Feature activos por subsidiaria
     ***************************************************************************/
    function updateItemLine(taxResults, recordObj, position, STS_JSON, licenses) {

        try {

            recordObj.selectLine({ sublistId: "item", line: position });

            var itemTotalTaxAmount = 0;
            if (taxResults[position]) {
                for (var i = 0; i < taxResults[position].length; i++) {
                    var isExempt = taxResults[position][i].isExempt;
                    if (isExempt == false || isExempt == "F") {
                        itemTotalTaxAmount += _round2(parseFloat(taxResults[position][i].retencion));
                    }
                }
            }

            _setTaxDetails(taxResults, recordObj, position, STS_JSON, licenses);

            recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_total_impuestos", value: itemTotalTaxAmount });

            var FEATURE_MULTIPRICE = runtime.isFeatureInEffect({ feature: "miltprice" });
            var taxAmount = parseFloat(itemTotalTaxAmount);

            if (recordObj.type != "itemfulfillment") {

                var itemNetAmount = recordObj.getCurrentSublistValue({ sublistId: "item", fieldId: "amount" });
                var itemQuantity = recordObj.getCurrentSublistValue({ sublistId: "item", fieldId: "quantity" });

                switch (STS_JSON.taxFlow) {

                    case "1": // Flujo 0
                        var itemGrossAmount = itemNetAmount + taxAmount;
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_base_amount", value: Math.round(itemNetAmount * 100) / 100 });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_total_impuestos", value: Math.round(taxAmount * 100) / 100 });
                        break;

                    case "2": // Flujo 1
                        var itemGrossAmount = recordObj.getCurrentSublistValue({ sublistId: "item", fieldId: "grossamt" });
                        itemNetAmount = itemGrossAmount - taxAmount;
                        var itemRate = parseFloat(itemNetAmount) / itemQuantity;
                        if (FEATURE_MULTIPRICE == true || FEATURE_MULTIPRICE == "T") {
                            recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "price", value: -1 });
                        }
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "rate", value: Math.round(parseFloat(itemRate) * 100) / 100 });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "amount", value: Math.round(parseFloat(itemNetAmount) * 100) / 100 });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_base_amount", value: Math.round(itemGrossAmount * 100) / 100 });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_total_impuestos", value: Math.round(taxAmount * 100) / 100 });
                        break;

                    case "3": // Flujo 2
                        itemNetAmount += taxAmount;
                        var itemRate = itemNetAmount / itemQuantity;
                        if (FEATURE_MULTIPRICE == true || FEATURE_MULTIPRICE == "T") {
                            recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "price", value: -1 });
                        }
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "rate", value: Math.round(parseFloat(itemRate) * 100) / 100 });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "amount", value: Math.round(parseFloat(itemNetAmount) * 100) / 100 });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_base_amount", value: Math.round(itemNetAmount * 100) / 100 });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_total_impuestos", value: Math.round(taxAmount * 100) / 100 });
                        break;

                    case "4":
                        var itemGrossAmount = recordObj.getCurrentSublistValue({ sublistId: "item", fieldId: "grossamt" });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_base_amount", value: Math.round(itemGrossAmount * 100) / 100 });
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_total_impuestos", value: Math.round(taxAmount * 100) / 100 });
                        break;

                }

            } else {
                var itemQuantity = recordObj.getCurrentSublistValue({ sublistId: "item", fieldId: "quantity" }) || 0.00;
                var itemPrice = recordObj.getCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_prec_unit_so" }) || 0.00;
                var baseAmount = _round2(parseFloat(itemQuantity) * parseFloat(itemPrice));

                recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_base_amount", value: _round2(baseAmount) });
                recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_base_amount", value: _round2(taxAmount) });
            }

            recordObj.commitLine({ sublistId: "item" });

        } catch (e) {
            Library_Mail.sendemail('[ updateItemLine ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ updateItemLine ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function _setTaxDetails(taxResults, recordObj, position, STS_JSON, licenses) {

        try {

            // var taxLineCount = recordObj.getLineCount({ sublistId: "taxdetails" });
            // if (taxLineCount != null && taxLineCount > 0) {
            //     for (var i = taxLineCount - 1; i >= 0; i--) {
            //         recordObj.removeLine({ sublistId: "taxdetails", line: i });
            //     }
            // }

            if (Library_Mail.getAuthorization(755, licenses) == true) {

                for (var i = 0; i < taxResults[position].length; i++) {

                    switch (STS_JSON.taxFlow) {
                        case "1":  // FLujo 0
                            recordObj.selectNewLine({ sublistId: "taxdetails" });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: taxResults[position][i].taxdetails.detailReference });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: taxResults[position][i].taxdetails.taxType });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: taxResults[position][i].taxdetails.taxCode });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: _round2(parseFloat(taxResults[position][i].taxdetails.taxBasis)) });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: parseFloat(taxResults[position][i].taxdetails.taxRate * 100) });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: _round2(parseFloat(taxResults[position][i].taxdetails.taxAmount)) });
                            recordObj.commitLine({ sublistId: "taxdetails" });
                            break;

                        case "2": // Flujo 1
                            recordObj.selectNewLine({ sublistId: "taxdetails" });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: taxResults[position][i].taxdetails.detailReference });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: taxResults[position][i].taxdetails.taxType });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: taxResults[position][i].taxdetails.taxCode });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: _round2(parseFloat(taxResults[position][i].taxdetails.taxBasis)) });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: parseFloat(taxResults[position][i].taxdetails.taxRate * 100) });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: _round2(parseFloat(taxResults[position][i].taxdetails.taxAmount)) });
                            recordObj.commitLine({ sublistId: "taxdetails" });
                            break;

                        case "3": // Flujo 2
                            recordObj.selectNewLine({ sublistId: "taxdetails" });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: taxResults[position][i].taxdetails.detailReference });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: taxResults[position][i].taxdetails.taxType });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: taxResults[position][i].taxdetails.taxCode });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: _round2(parseFloat(taxResults[position][i].taxdetails.taxBasis)) });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: parseFloat(taxResults[position][i].taxdetails.taxRate * 100) });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: 0.00 });
                            recordObj.commitLine({ sublistId: "taxdetails" });
                            break;

                        case "4": // Flujo 3
                            recordObj.selectNewLine({ sublistId: "taxdetails" });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: taxResults[position][i].taxdetails.detailReference });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: taxResults[position][i].taxdetails.taxType });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: taxResults[position][i].taxdetails.taxCode });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: _round2(parseFloat(taxResults[position][i].taxdetails.taxBasis)) });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: parseFloat(taxResults[position][i].taxdetails.taxRate * 100) });
                            recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: 0.00 });
                            recordObj.commitLine({ sublistId: "taxdetails" });
                            break;
                    }

                }

            } else {

                var itemTotalTaxAmount = 0;
                var itemBaseAmount = 0;
                var itemTaxRate = 0;
                if (taxResults[position]) {
                    for (var i = 0; i < taxResults[position].length; i++) {
                        var isExempt = taxResults[position][i].isExempt;
                        if (isExempt == false || isExempt == "F") {
                            itemTotalTaxAmount += _round2(parseFloat(taxResults[position][i].retencion));
                            itemBaseAmount = _round2(parseFloat(taxResults[position][i].taxdetails.taxBasis));
                            itemTaxRate += _round2(parseFloat(taxResults[position][i].taxdetails.taxRate) * 100)
                        }
                    }
                }

                var itemDetailReference = taxResults[position][0].taxdetails.detailReference;

                recordObj.selectNewLine({ sublistId: "taxdetails" });
                recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: itemDetailReference });
                recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: STS_JSON.taxType });
                recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: STS_JSON.taxCode });
                recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: itemBaseAmount });
                recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: itemTaxRate });
                recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: itemTotalTaxAmount});
                recordObj.commitLine({ sublistId: "taxdetails" });

            }

        } catch (e) {
            Library_Mail.sendemail('[ _setTaxDetails ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _setTaxDetails ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function createTaxResult(taxResults, recordObj, difalActive) {

        try {

            var arrayTR = [];
            var concatBooks = _concatAccountingBooks(recordObj);

            for (var pos in taxResults) {
                for (var i = 0; i < taxResults[pos].length; i++) {

                    var TR_Record = record.create({
                        type: "customrecord_lmry_br_transaction",
                        isDynamic: false
                    });

                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_related_id", value: "" + recordObj.id });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_transaction", value: "" + recordObj.id });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_type", value: taxResults[pos][i].subType });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_type_id", value: taxResults[pos][i].subTypeID });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_base_amount", value: _round4(taxResults[pos][i].baseAmount) });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_total", value: _round4(taxResults[pos][i].retencion) });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_percent", value: _round4(taxResults[pos][i].taxRate) });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_total_item", value: "Line - Item" });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_item", value: taxResults[pos][i].items });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_positem", value: parseInt(taxResults[pos][i].posicionItem) });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_lineuniquekey", value: parseInt(taxResults[pos][i].lineUniqueKey) });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_lineuniquekey", value: parseInt(taxResults[pos][i].lineUniqueKey) });

                    if (taxResults[pos][i].caso == "2I") { // Entidad - Items
                        TR_Record.setValue({ fieldId: "custrecord_lmry_ccl", value: taxResults[pos][i].idCCNT });
                        TR_Record.setValue({ fieldId: "custrecord_lmry_br_ccl", value: taxResults[pos][i].idCCNT });
                    } else { // Subsidiaria - Items
                        TR_Record.setValue({ fieldId: "custrecord_lmry_ntax", value: taxResults[pos][i].idCCNT });
                        TR_Record.setValue({ fieldId: "custrecord_lmry_br_ccl", value: taxResults[pos][i].idCCNT });
                    }

                    TR_Record.setValue({ fieldId: "custrecord_lmry_accounting_books", value: concatBooks });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_tax_description", value: taxResults[pos][i].description });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_total_base_currency", value: _round4(taxResults[pos][i].localCurrAmt) });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_tax_type", value: "4" });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_receta", value: taxResults[pos][i].receita });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_tax_taxsituation", value: taxResults[pos][i].taxSituation });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_tax_nature_revenue", value: taxResults[pos][i].natureRevenue });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_regimen_asoc_catalog", value: taxResults[pos][i].regimen });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_created_from_script", value: 1 });
                    TR_Record.setValue({ fieldId: "custrecord_lmry_base_amount_local_currc", value: taxResults[pos][i].localCurrBaseAmt }) || 0.00;
                    TR_Record.setValue({ fieldId: "custrecord_lmry_amount_local_currency", value: taxResults[pos][i].localCurrAmt }) || 0.00;
                    TR_Record.setValue({ fieldId: "custrecord_lmry_gross_amt_local_curr", value: taxResults[pos][i].localCurrGrossAmt }) || 0.00;

                    if (difalActive) {
                        TR_Record.setValue({ fieldi: "custrecord_lmry_br_difal_alicuota", value: taxResults[pos][i].difalOrigen }) || "";
                        TR_Record.setValue({ fieldi: "custrecord_lmry_br_difal_alicuota_des", value: taxResults[pos][i].difalDestination }) || "";
                        TR_Record.setValue({ fieldi: "custrecord_lmry_br_difal_amount", value: taxResults[pos][i].difalAmountauto }) || 0.00;
                    } else {
                        TR_Record.setValue({ fieldId: "custrecord_lmry_br_difal_alicuota", value: taxResults[pos][i].difalTaxRate }) || 0.00;
                        TR_Record.setValue({ fieldId: "custrecord_lmry_br_difal_amount", value: taxResults[pos][i].difalAmount }) || 0.00;
                    }

                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_apply_report", value: taxResults[pos][i].isApplyReport }) || "";
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_is_import_tax_result", value: taxResults[pos][i].isImportTax }) || "";
                    TR_Record.setValue({ fieldId: "custrecord_lmry_br_base_no_tributada", value: taxResults[pos][i].baseNoTributada }) || "";
                    TR_Record.setValue({ fieldId: "custrecord_lmry_base_no_tributad_loc_cur", value: taxResults[pos][i].baseNoTributadaLocCurr }) || "";
                    TR_Record.setValue({ fieldId: "custrecord_lmry_is_substitution_tax_resu", value: taxResults[pos][i].isSubstitutionTax }) || "";
                    TR_Record.setValue({ fieldId: "custrecord_lmry_res_fa_tax_rate", value: taxResults[pos][i].faTaxRate }) || "";
                    TR_Record.setValue({ fieldId: "custrecord_lmry_res_fa_tax_amount", value: taxResults[pos][i].faTaxAmount }) || "";
                    TR_Record.setValue({ fieldId: "custrecord_lmry_res_fixasset_ns", value: taxResults[pos][i].fixedAssetNS }) || "";
                    TR_Record.setValue({ fieldId: "custrecord_lmry_res_fixasset", value: taxResults[pos][i].fixedAsset }) || "";

                    var TR_RecordID = TR_Record.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });

                    arrayTR.push(parseInt(TR_RecordID));

                }
            }

            return arrayTR;

        } catch (e) {
            Library_Mail.sendemail('[ createTaxResult ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ createTaxResult ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function _concatAccountingBooks(recordObj) {

        try {

            var auxBookMB = 0;
            var transactionExchangeRate = recordObj.getValue({ fieldId: "exchangerate" });

            if (FEATURE_MULTIBOOK == true || FEATURE_MULTIBOOK == "T") {
                if (recordObj.type != "itemfulfillment") {

                    var bookLineCount = recordObj.getLineCount({ sublistId: "accountingbookdetail" });
                    if (bookLineCount != null && bookLineCount > 0) {
                        for (var i = 0; i < bookLineCount; i++) {
                            var book = recordObj.getSublistValue({ sublistId: "accountingbookdetail", fieldId: "accountingbook", line: i });
                            var bookEchangeRate = recordObj.getSublistValue({ sublistId: "accountingbookdetail", fieldId: "exchangerate", line: i });
                            auxBookMB = auxBookMB + "|" + book;
                            transactionExchangeRate = transactionExchangeRate + "|" + bookEchangeRate;
                        }
                    }

                } else {

                    var LineBook_Search = search.create({
                        type: "transaction",
                        columns: [
                            "accountingTransaction.accountingbook",
                            "accountingTransaction.exchangerate"
                        ],
                        filters: [
                            [ "mainline", "is", "T" ],
                            "AND",
                            [ "internalid", "anyof", recordObj.id ]
                        ]
                    }).run().getRange(0, 100);

                    if (LineBook_Search != null && LineBook_Search.length > 0) {
                        for (var i = 0; i < LineBook_Search.length; i++) {
                            var book = LineBook_Search[i].getValue({ name: "accountingbook", join: "accountingTransaction" });
                            var bookEchangeRate = LineBook_Search[i].getValue({ name: "exchangerate", join: "accountingTransaction" });
                            auxBookMB = auxBookMB + "|" + book;
                            transactionExchangeRate = transactionExchangeRate + "|" + bookEchangeRate;
                        }
                    }

                }
            }

            return auxBookMB + "&" + transactionExchangeRate;

        } catch (e) {
            Library_Mail.sendemail('[ _concatAccountingBooks ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _concatAccountingBooks ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function addTaxItems(recordObj, taxResults, STS_Department, STS_Class, STS_Location) {

        try {

            _deleteTaxItemLines(recordObj);

            var transactionDepartment = recordObj.getValue({ fieldId: "department" }) || "";
            var transactionClass = recordObj.getValue({ fieldId: "class" }) || "";
            var transactionLocation = recordObj.getValue({ fieldId: "location" }) || "";
            log.debug('[ transactionDepartment - transactionClass - transactionLocation ]', [transactionDepartment, transactionClass, transactionLocation]);
            var taxItemsJSON = {};
            for (var pos in taxResults) {
                for (var i = 0; i < taxResults[pos].length; i++) {

                    var taxResult = taxResults[pos][i];
                    var subTypeID = taxResult.subTypeID;
                    var subType = taxResult.subType;
                    var taxItem = taxResult.taxItem;
                    var taxAmount = taxResult.retencion;
                    var taxCode = taxResult.taxCode;
                    var isTaxNotIncluded = taxResult.isTaxNotIncluded;
                    log.debug('[subTypeID, subType, taxItem, taxAmount, taxCode, isTaxNotIncluded]', [subTypeID, subType, taxItem, taxAmount, taxCode, isTaxNotIncluded]);
                    if (isTaxNotIncluded && taxItem) {
                        var key = subTypeID + "-" + taxItem;
                        if (!taxItemsJSON[key]) {
                            taxItemsJSON[key] = {
                                subTypeId: subTypeID,
                                subType: subType,
                                item: taxItem,
                                taxCode: taxCode,
                                amount: 0.00
                            }
                        }
                        taxItemsJSON[key].amount += parseFloat(taxAmount);
                    }

                }
            }
            log.debug('[ taxItemsJSON ]', taxItemsJSON);
            for (var k in taxItemsJSON) {

                // var itemLineCount = recordObj.getLineCount({ sublistId: "item" })
                var tax = taxItemsJSON[k];
                var subType = tax.subType;
                var item = tax.item;
                var amount = _round2(tax.amount);
                var taxCode = tax.taxCode || "";
                // var taxType = _getTaxTypeByTaxCode(taxCode) || "";

                if (amount > 0) {

                    // New item line
                    recordObj.selectNewLine({ sublistId: "item" });
                    recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "item", value: item });
                    recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: 1 });
                    recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "rate", value: amount });
                    recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "description", value: subType + " (LatamTax)" });
                    recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_ar_item_tributo", value: true });
                    recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_lmry_apply_wht_tax", value: false });
                    if (FEATURE_DEPARTMENT == true || FEATURE_DEPARTMENT == "T") {
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "department", value: transactionDepartment });
                        if (MANDATORY_DEPARTMENT == true || MANDATORY_DEPARTMENT == "T" && !transactionDepartment) {
                            recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "department", value: STS_Department });
                        }
                    }
                    if (FEATURE_CLASS == true ||FEATURE_CLASS == "T") {
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "class", value: transactionClass });
                        if (MANDATORY_CLASS == true || MANDATORY_CLASS == "T" && !transactionClass) {
                            recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "class", value: STS_Class });
                        }
                    }
                    if (FEATURE_LOCATION == true || FEATURE_LOCATION == "T") {
                        recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "location", value: transactionLocation });
                        if (MANDATORY_LOCATION == true || MANDATORY_LOCATION == "T" && !transactionLocation) {
                            recordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "location", value: STS_Location });
                        }
                    }
                    recordObj.commitLine({ sublistId: "item" });

                    // var itemDetailReference = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: itemLineCount });
                    //
                    // New tax detail line
                    // recordObj.selectLine({ sublistId: "taxdetails" });
                    // recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: itemDetailReference });
                    // recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: taxType });
                    // recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: taxCode });
                    // recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: amount });
                    // recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: 0.00 });
                    // recordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: 0.00 });
                    // recordObj.commitLine({ sublistId: "taxdetails" });

                }

            }

        } catch (e) {
            Library_Mail.sendemail('[ addTaxItems ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ addTaxItems ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function _getTaxTypeByTaxCode (taxCodeID) {

        try {

            var TaxCode_Search = search.lookupFields({
                type: "salestaxitem",
                id: taxCodeID,
                columns: [ "custrecord_lmry_ste_setup_tax_type" ]
            });

            var taxType = TaxCode_Search.custrecord_lmry_ste_setup_tax_type[0].value;

            return taxType;

        } catch (e) {
            Library_Mail.sendemail('[ _getTaxTypeByTaxCode ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _getTaxTypeByTaxCode ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function _deleteTaxItemLines(recordObj) {

        try {

            while (true) {
                var indexRemove = 1;
                var itemLineCount = recordObj.getLineCount({ sublistId: "item" });

                for (var i = 0; i < itemLineCount; i++) {
                    var isItemTax = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_ar_item_tributo", line: i });
                    if (isItemTax == true || isItemTax == "T") {
                        indexRemove = i;
                        break;
                    }
                }

                if (indexRemove > 1) {
                    recordObj.removeLine({ sublistId: "item", line: indexRemove });
                } else {
                    break;
                }
            }

        } catch (e) {
            Library_Mail.sendemail('[ _deleteTaxItemLines ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _deleteTaxItemLines ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    /***************************************************************************
     *  Creacion de un Journal Entry para Credit Card
     *  Parametros:
     *      recordObj: Transaccion del cual se hara
     *      STS_JSON: Configuracion del record LatamReady - Setup Tax Subsidiary
     ***************************************************************************/
    function createJournalCreditCard(recordObj, STS_JSON) {

        try {

            var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
            var transactionDate = recordObj.getValue({ fieldId: "trandate" });
            var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
            var transactionExchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
            var transactionDepartment = recordObj.getValue({ fieldId: "department" });
            var transactionClass = recordObj.getValue({ fieldId: "class" });
            var transactionLocation = recordObj.getValue({ fieldId: "location" });

            var newJournalRecord = record.create({
                type: record.Type.JOURNAL_ENTRY,
                isDynamic: true
            });

            if (!STS_JSON.formjournal) {
                return true;
            }

            newJournalRecord.setValue({ fieldId: "customform", value: STS_JSON.formJournal });

            if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                newJournalRecord.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });
            }

            newJournalRecord.setValue({ fieldId: "trandate", value: transactionDate });
            newJournalRecord.setValue({ fieldId: "custbody_lmry_reference_transaction", value: recordObj.id });
            newJournalRecord.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: recordObj.id });
            newJournalRecord.setValue({ fieldId: "currency", value: transactionCurrency });
            newJournalRecord.setValue({ fieldId: "exchangerate", value: transactionExchangeRate });
            newJournalRecord.setValue({ fieldId: "memo", value: "STE Credit Card Transaction: " + recordObj.id });

            if (FEATURE_APPROVAL == true || FEATURE_APPROVAL == "T") {
                newJournalRecord.setValue({ fieldId: "approvalstatus", value: 2 });
            }

            /*
             * BUSQUEDA DE TAX RESULTS DE CALCULO DE IMPUESTOS
             */
            var TRs_Columns = [
                search.createColumn({ name: "custrecord_lmry_br_type", label: "Latam - Sub Type" }),
                search.createColumn({ name: "custrecord_lmry_br_type_id", label: "Latam - Sub Type List" }),
                search.createColumn({ name: "custrecord_lmry_br_total", label: "Latam - Total" }),
                search.createColumn({ name: "custrecord_lmry_br_positem", label: "Latam - BR Item / Expense Position" }),
                search.createColumn({ name: "custrecord_lmry_item", label: "Latam - Item" }),
                search.createColumn({ name: "custrecord_lmry_ccl", label: "Latam - Contributory Class" }),
                search.createColumn({ name: "custrecord_lmry_ntax", label: "Latam - National Tax" }),
                search.createColumn({ name: "custrecord_lmry_br_is_import_tax_result", label: "Latam - BR Is Import Tax?" }),
                search.createColumn({ name: "custrecord_lmry_ccl_br_nivel_contabiliz", join: "custrecord_lmry_ccl", label: "Latam - Nivel de Contabilización" }),
                search.createColumn({ name: "custrecord_lmry_nt_br_nivel_contabiliz", join: "custrecord_lmry_ntax", label: "Latam - Nivel de Contabilización" }),
                search.createColumn({ name: "custrecord_lmry_is_substitution_tax_resu", label: "Latam BR - Es Sustitución Tributaria?" }),
                search.createColumn({ name: "custrecord_lmry_is_tax_not_included", join: "custrecord_lmry_br_type_id", label: "LATAM - BR IS TAX NOT INCLUDED?" })
            ];

            var TRs_Filters = [
                search.createFilter({ name: "custrecord_lmry_br_transaction", operator: "ANYOF", values: recordObj.id }),
                search.createFilter({ name: "custrecord_lmry_tax_type", operator: "IS", values: "4" })
            ];

            var TRs_Search = search.create({
                type: "customrecord_lmry_br_transaction",
                columns: TRs_Columns,
                filters: TRs_Filters
            }).run().getRange(0, 1000);

            if (TRs_Search != null && TRs_Search.length > 0) {
                for (var i = 0; i < TRs_Search.length; i++) {

                    var TR_SubType = TRs_Search[i].getValue({ name: "custrecord_lmry_br_type" });
                    var TR_SubTypeID = TRs_Search[i].getValue({ name: "custrecord_lmry_br_type_id" });
                    var TR_Amount = TRs_Search[i].getValue({ name: "custrecord_lmry_br_total" });
                    var TR_Item = TRs_Search[i].getValue({ name: "custrecord_lmry_item" });
                    var TR_Position = TRs_Search[i].getValue({ name: "custrecord_lmry_br_positem" });
                    var TR_ContributoryClass = TRs_Search[i].getValue({ name: "custrecord_lmry_ccl" });
                    var TR_NationalTax = TRs_Search[i].getValue({ name: "custrecord_lmry_ntax" });
                    var TR_IsImportTax = TRs_Search[i].getValue({ name: "custrecord_lmry_br_is_import_tax_result" });
                    var TR_IsSubstitutionTax = TRs_Search[i].getValue({ name: "custrecord_lmry_is_substitution_tax_resu" });
                    var TR_IsTaxNotIncluded = TRs_Search[i].getValue({ name: "custrecord_lmry_is_tax_not_included", join: "custrecord_lmry_br_type_id" });

                    TR_Amount = _round2(TR_Amount);
                    if (TR_Amount <= 0) {
                        continue;
                    }

                    if (!TR_ContributoryClass && !TR_NationalTax) {
                        continue;
                    }

                    if(Number(STS_JSON.taxFlow) == 4) {
                        if ((TR_IsImportTax == true || TR_IsImportTax == "T") || (TR_IsTaxNotIncluded == true || TR_IsTaxNotIncluded == "T")) {
                            continue;
                        }
                    }

                    var TR_ImportTaxLevel = (TR_ContributoryClass) ?
                                            TRs_Search[i].getValue({ name: "custrecord_lmry_ccl_br_nivel_contabiliz", join: "custrecord_lmry_ccl" }) :
                                            TRs_Search[i].getValue({ name: "custrecord_lmry_ccl_br_nivel_contabiliz", join: "custrecord_lmry_ntax" });

                    if ((TR_IsImportTax == true || TR_IsImportTax == "T") && (Number(TR_ImportTaxLevel) != 1)) {
                        continue;
                    }

                    var recordType = (TR_ContributoryClass) ? "customrecord_lmry_ar_contrib_class" : "customrecord_lmry_national_taxes";
                    var recordID = TR_ContributoryClass || TR_NationalTax;

                    if (TR_ContributoryClass) {

                        var CC_Search = search.lookupFields({
                            type: recordType,
                            id: recordID,
                            columns: [
                                "custrecord_lmry_br_ccl_account2",
                                "custrecord_lmry_br_ccl_account1",
                                "custrecord_lmry_ccl_gl_impact",
                                "custrecord_lmry_ccl_config_segment"
                            ]
                        });
                        var DebitAccount = CC_Search.custrecord_lmry_br_ccl_account1[0].value || "";
                        var CreditAccount = CC_Search.custrecord_lmry_br_ccl_account2[0].value || "";
                        var GlImpact = CC_Search.custrecord_lmry_ccl_gl_impact;

                    } else {

                        var NT_Search = search.lookupFields({
                            type: recordType,
                            id: recordID,
                            columns: [
                                "custrecord_lmry_ntax_credit_account",
                                "custrecord_lmry_ntax_debit_account",
                                "custrecord_lmry_ntax_gl_impact",
                                "custrecord_lmry_ntax_config_segment"
                            ]
                        });
                        var DebitAccount = CC_Search.custrecord_lmry_ntax_debit_account[0].value || "";
                        var CreditAccount = CC_Search.custrecord_lmry_ntax_credit_account[0].value || "";
                        var GlImpact = CC_Search.custrecord_lmry_ntax_gl_impact;

                    }

                    var auxMemo = (TR_ContributoryClass) ? "Contributory Class" : "National Tax";

                    if ((GlImpact == false || GlImpact == "F") || !DebitAccount || !CreditAccount) {
                        continue;
                    }

                    if (TR_Position == "" || TR_Position == null) {
                        continue;
                    }

                    var itemDepartment = recordObj.getSublistValue({ sublistId: "item", fieldId: "department", line: TR_Position });
                    var itemClass = recordObj.getSublistValue({ sublistId: "item", fieldId: "class", line: TR_Position });
                    var itemLocation = recordObj.getSublistValue({ sublistId: "item", fieldId: "location", line: TR_Position });

                    var oldDeparment = itemDepartment || transactionDepartment;
                    var oldClass = itemClass || transactionClass;
                    var oldLocation = itemLocation || transactionLocation;

                    if (STS_JSON.segmentacion) {
                        var newDepartment = _chooseSegmentation(MANDATORY_DEPARTMENT, oldDeparment, transactionDepartment, STS_JSON.department, transactionDeparment);
                        var newClass = _chooseSegmentation(MANDATORY_CLASS, oldClass, transactionClass, STS_JSON.class, transactionClass);
                        var newLocation = _chooseSegmentation(MANDATORY_LOCATION, oldLocation, transactionLocation, STS_JSON.location, transactionLocation);
                    } else {
                        var newDepartment = _chooseSegmentation(MANDATORY_DEPARTMENT, oldDeparment, transactionDepartment, STS_JSON.department, "");
                        var newClass = _chooseSegmentation(MANDATORY_CLASS, oldClass, transactionClass, STS_JSON.class, "");
                        var newLocation = _chooseSegmentation(MANDATORY_LOCATION, oldLocation, transactionLocation, STS_JSON.location, "");
                    }

                    var itemUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: TR_Position });
                    // Debit Line
                    newJournalRecord.selectNewLine({ sublistId: "line" });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: DebitAccount });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "debit", value: TR_Amount });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_br_tax", value: TR_SubTypeID });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: TR_SubType + " (LatamTax - " + auxMemo + ")" });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_item_posicion", value: itemUniqueKey });
                    if (FEATURE_DEPARTMENT && newDepartment) {
                        newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: newDepartment });
                    }
                    if (FEATURE_CLASS && newClass) {
                        newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: newClass });
                    }
                    if (FEATURE_LOCATION && newLocation) {
                        newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: newLocation });
                    }
                    newJournalRecord.commitLine({ sublistId: "line" });

                    // Credit Line
                    newJournalRecord.selectNewLine({ sublistId: "line" });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: CreditAccount });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "credit", value: TR_Amount });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_br_tax", value: TR_SubTypeID });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: TR_SubType + " (LatamTax - " + auxMemo + ")" });
                    newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "custcol_lmry_item_posicion", value: itemUniqueKey });
                    if (FEATURE_DEPARTMENT && newDepartment) {
                        newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: newDepartment });
                    }
                    if (FEATURE_CLASS && newClass) {
                        newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: newClass });
                    }
                    if (FEATURE_LOCATION && newLocation) {
                        newJournalRecord.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: newLocation });
                    }
                    newJournalRecord.commitLine({ sublistId: "line" });

                }
            }

            newJournalRecord.save({
                ignoreMandatoryFields: true,
                disableTriggers: true
            });

        } catch (e) {
            Library_Mail.sendemail('[ createJournalCreditCard ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ createJournalCreditCard ]', message: e, relatedScript: LMRY_script_Name });
        }

    }

    function _chooseSegmentation(pref, valor1, valor2, valorSetup, valorDefecto) {

        try {

            if (valor1 != null && valor1 != '') {
                return valor1;
            } else {
                if (pref == 'T' || pref == true) {
                    if (valor2 == null || valor2 == '') {
                        return valorSetup;
                    } else {
                        return valor2;
                    }
                } else {
                    if (valorDefecto != '' && valorDefecto != null) {
                        return valorDefecto;
                    }
                }
            }

            return "";

        } catch (e) {
            Library_Mail.sendemail('[ _chooseSegmentation ]: ' + e, LMRY_Script);
            Library_Log.doLog({ title: '[ _chooseSegmentation ]', message: e, relatedScript: LMRY_script_Name });
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
        getTaxPurchase: getTaxPurchase,
        getSetupTaxSubsidiary: getSetupTaxSubsidiary,
        updateItemLine: updateItemLine,
        createTaxResult: createTaxResult,
        addTaxItems: addTaxItems,
        createJournalCreditCard: createJournalCreditCard
    };

});
