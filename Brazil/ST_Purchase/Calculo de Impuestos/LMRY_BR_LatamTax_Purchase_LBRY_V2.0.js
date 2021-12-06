/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_LatamTax_Purchase_LBRY_V2.0.js           ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 05 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/log', 'N/record', 'N/search', 'N/runtime', 'N/suiteAppInfo', './LMRY_Log_LBRY_V2.0.js', "./LMRY_libSendingEmailsLBRY_V2.0"],
    function (log, record, search, runtime, suiteAppInfo, lbryLog, libraryMail) {

        var LMRY_script = 'LatamReady - BR LatamTax Purchase LBRY';
        var arreglo_SumaBaseBR = new Array();
        var arreglo_IndiceBaseBR = new Array();
        var blnTaxCalculate = false;
        var totalItemTaxes = {};
        var applyWHT = false;
        var jsonArray = {};
        var NS_FA_ACTIVE = false;

        //Activacion de enable features
        var enab_dep = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
        var enab_loc = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
        var enab_clas = runtime.isFeatureInEffect({ feature: "CLASSES" });

        var DEPTMANDATORY = runtime.getCurrentUser().getPreference({ name: "DEPTMANDATORY" });
        var LOCMANDATORY = runtime.getCurrentUser().getPreference({ name: "LOCMANDATORY" });
        var CLASSMANDATORY = runtime.getCurrentUser().getPreference({ name: "CLASSMANDATORY" });

        var featureAprove = runtime.getCurrentScript().getParameter({ name: 'CUSTOMAPPROVALJOURNAL' });
        var FEAT_CUSTOMSEGMENTS = runtime.isFeatureInEffect({feature: "CUSTOMSEGMENTS"});

        var subsiOW = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});

        function getTaxPurchase(recordObj, setupTax, difalActive, ispreview) {
            try {
                jsonArray = {};
                var cantidad = 0;
                var typeTransaction = recordObj.getValue("baserecordtype");
                var filtroTransactionType;
                switch (typeTransaction) {
                    case 'purchaseorder':
                        filtroTransactionType = 6;
                        break;
                    case 'vendorbill':
                        filtroTransactionType = 4;
                        break;
                    case 'vendorcredit':
                        filtroTransactionType = 7;
                        break;
                    case 'itemfulfillment':
                        filtroTransactionType = 12;
                        break;
                    case 'creditcardcharge':
                        filtroTransactionType = 15;
                        break;
                    case 'creditcardrefund':
                        filtroTransactionType = 16;
                        break;
                    default:
                        return true;
                }
                //Si es anulacion
                if (recordObj.getValue('voided') == 'T') {
                    return true;
                }

                var wtax_wcod = recordObj.getValue({
                    fieldId: 'custpage_4601_witaxcode'
                });

                var country = recordObj.getText({
                    fieldId: 'custbody_lmry_subsidiary_country'
                });

                var idCountry = recordObj.getValue({
                    fieldId: 'custbody_lmry_subsidiary_country'
                });

                applyWHT = recordObj.getValue({
                    fieldId: 'custbody_lmry_apply_wht_code'
                });

                var documentType = recordObj.getValue({
                    fieldId: 'custbody_lmry_document_type'
                });

                var province = recordObj.getValue({
                    fieldId: 'custbody_lmry_province'
                });

                var city = recordObj.getValue({
                    fieldId: 'custbody_lmry_city'
                });

                var district = recordObj.getValue({
                    fieldId: 'custbody_lmry_district'
                });

                var entity = recordObj.getValue({
                    fieldId: 'entity'
                });
                var featureSubs = runtime.isFeatureInEffect({
                    feature: "SUBSIDIARIES"
                });

                var fecha = recordObj.getText({
                    fieldId: 'trandate'
                });

                var subsidiary;
                if (featureSubs) {
                    subsidiary = recordObj.getValue({
                        fieldId: 'subsidiary'
                    });
                } else {
                    subsidiary = recordObj.getValue({
                        fieldId: 'custbody_lmry_subsidiary_country'
                    });
                }

                if (!setupTax) {
                    setupTax = getSetupTaxSubsidiary(subsidiary);
                }

                NS_FA_ACTIVE = fixedAssetBundleActive(subsidiary);

                var ArraySubtype = getDifalinSubtype();

                var JsonProvinceRate = getProvinceRate();

                var DataBRTrans = getBRTransFields(recordObj.id);

                var hasProvince = false;

                var hasProvOrigen = province ? province : DataBRTrans['province'];

                var provinceBRTranFields = DataBRTrans['province'];

                if (hasProvOrigen && setupTax['province']) hasProvince = true;

                var difalmatch = false;

                if (setupTax['fiscalobs'] && setupTax['fiscalobs'] == DataBRTrans['fiscalobs']) difalmatch = true;

                var exchangeRate = getExchangeRate(recordObj, setupTax["currency"]);

                log.debug('LBRY - exchangeRate', exchangeRate);

                var retencion = 0;
                var baseAmount = 0;
                var compareAmount = 0;
                var cantidad_items = recordObj.getLineCount({
                    sublistId: 'item'
                });

                var taxCalculationForm = setupTax["taxFlow"];

                var mvaRecords = {}, taxesToST = {}, stTaxes = {}, taxesNotIncluded = {};
                if (Number(taxCalculationForm) == 4 && typeTransaction != "itemfulfillment") {
                    mvaRecords = getmvaRecords(recordObj);
                    log.debug("mvaRecords", JSON.stringify(mvaRecords));
                }

                var sumaBaseCalculoI = 0;
                /********************************************************
                 * Busqueda en el record: LatamReady - Contributory Class
                 ********************************************************/
                var filtrosCC = [
                    ['isinactive', 'is', 'F'], 'AND',
                    ['custrecord_lmry_ar_ccl_fechdesd', 'onorbefore', fecha], 'AND',
                    ['custrecord_lmry_ar_ccl_fechhast', 'onorafter', fecha], 'AND',
                    ['custrecord_lmry_ccl_transactiontypes', 'anyof', filtroTransactionType], 'AND',
                    ['custrecord_lmry_ar_ccl_entity', 'anyof', entity], 'AND',
                    ['custrecord_lmry_ccl_appliesto', 'anyof', '2'], 'AND',
                    ['custrecord_lmry_ccl_taxtype', 'anyof', '4'], 'AND',
                    ['custrecord_lmry_ccl_gen_transaction', 'anyof', '3']
                ];

                var documents = ['@NONE@'];
                if (documentType) {
                    documents.push(documentType);
                }
                filtrosCC.push('AND', ['custrecord_lmry_ccl_fiscal_doctype', 'anyof', documents]);

                if (featureSubs) {
                    filtrosCC.push('AND', ['custrecord_lmry_ar_ccl_subsidiary', 'anyof', subsidiary])
                }

                var provinces = ['@NONE@'];
                if (province) {
                    provinces.push(province);
                }

                var cities = ['@NONE@'];
                if (city) {
                    cities.push(city)
                }

                var districts = ['@NONE@'];
                if (district) {
                    districts.push(district);
                }

                filtrosCC.push('AND', [
                    [
                        ["custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "is", "F"]
                    ]
                    , "OR", [
                        ["custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "is", "T"],
                        'AND', ["custrecord_lmry_ccl_province", "anyof", provinces],
                        'AND', ["custrecord_lmry_ccl_city", "anyof", cities],
                        'AND', ["custrecord_lmry_ccl_district", "anyof", districts]
                    ]
                ]);

                var searchCC = search.create({
                    type: 'customrecord_lmry_ar_contrib_class',
                    columns: [{
                        name: "custrecord_lmry_ccl_tax_rule",
                        sort: search.Sort.ASC
                    }, {
                        name: 'custrecord_lmry_br_exclusive',
                        sort: search.Sort.ASC
                    }, 'internalid',
                    'custrecord_lmry_ar_ccl_taxrate',
                    'custrecord_lmry_amount',
                    'custrecord_lmry_sub_type',
                        'custrecord_lmry_ccl_minamount',
                        'custrecord_lmry_br_ccl_account1',
                        'custrecord_lmry_br_ccl_account2',
                        'custrecord_lmry_ccl_gl_impact',
                        'custrecord_lmry_ccl_addratio',
                        'custrecord_lmry_ccl_description',
                        'custrecord_lmry_ccl_maxamount',
                        'custrecord_lmry_ccl_not_taxable_minimum',
                        'custrecord_lmry_ccl_base_amount',
                        'custrecord_lmry_ccl_set_baseretention',
                        'custrecord_lmry_br_ccl_rate_suma',
                        'custrecord_lmry_br_receita',
                        'custrecord_lmry_ar_ccl_isexempt',
                        'custrecord_lmry_br_taxsituation',
                        'custrecord_lmry_br_nature_revenue',
                        'custrecord_lmry_br_ccl_regimen_catalog',
                        'custrecord_lmry_sub_type.custrecord_lmry_tax_by_location',
                        'custrecord_lmry_ccl_difal',
                        'custrecord_lmry_sub_type.custrecord_lmry_br_is_import_tax',
                        'custrecord_lmry_ccl_br_apply_report',
                        'custrecord_lmry_ccl_is_reduction',
                        'custrecord_lmry_ccl_reduction_ratio',
                        'custrecord_lmry_sub_type.custrecord_lmry_is_tax_not_included',
                        'custrecord_lmry_ccl_is_substitution',
                        'custrecord_lmry_ar_ccl_taxitem',
                        'custrecord_lmry_ar_ccl_taxcode',
                        'custrecord_lmry_ccl_fa_tax_rate'
                    ],
                    filters: filtrosCC
                });
                var searchResultCC = searchCC.run().getRange({
                    start: 0,
                    end: 1000
                });
                log.debug('LBRY - searchResultCC', searchResultCC.length);
                if (searchResultCC != null && searchResultCC.length > 0) {

                    for (var i = 0; i < searchResultCC.length; i++) {
                        var internalIdCC = searchResultCC[i].getValue({
                            name: 'internalid'
                        });

                        var taxrate = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ar_ccl_taxrate'
                        });
                        var amount_to = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_amount'
                        });
                        var subtype = searchResultCC[i].getText({
                            name: 'custrecord_lmry_sub_type'
                        });

                        var subtype_id = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_sub_type'
                        });

                        var min_amount = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_minamount'
                        });
                        var max_amount = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_maxamount'
                        });
                        var account1 = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_br_ccl_account1'
                        });
                        var account2 = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_br_ccl_account2'
                        });
                        var rule_br = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_tax_rule'
                        });
                        var ratio = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_addratio'
                        });
                        var description = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_description'
                        });
                        var not_taxable_minimun = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_not_taxable_minimum'
                        });
                        var how_base_amount = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_base_amount'
                        });
                        var base_retention = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_set_baseretention'
                        });
                        var is_exclusive = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_br_exclusive'
                        });
                        var glimpact = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ccl_gl_impact'
                        });
                        var receita = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_br_receita'
                        });
                        var isExempt = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_ar_ccl_isexempt'
                        });
                        var taxSituation = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_br_taxsituation'
                        });
                        var natureRevenue = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_br_nature_revenue'
                        });
                        var regimen = searchResultCC[i].getValue({
                            name: 'custrecord_lmry_br_ccl_regimen_catalog'
                        });

                        var isTaxByLocation = searchResultCC[i].getValue({
                            join: "custrecord_lmry_sub_type",
                            name: "custrecord_lmry_tax_by_location"
                        });

                        var difalTaxRate = searchResultCC[i].getValue({
                            name: "custrecord_lmry_ccl_difal"
                        }) || 0.00;
                        difalTaxRate = parseFloat(difalTaxRate);

                        var isImportTax = searchResultCC[i].getValue({
                            join: "custrecord_lmry_sub_type",
                            name: "custrecord_lmry_br_is_import_tax"
                        });

                        var isApplyReport = searchResultCC[i].getValue({
                            name: "custrecord_lmry_ccl_br_apply_report"
                        });

                        var isReduction = searchResultCC[i].getValue({
                            name: "custrecord_lmry_ccl_is_reduction"
                        });

                        var reductionRatio = searchResultCC[i].getValue({
                            name: "custrecord_lmry_ccl_reduction_ratio"
                        }) || 1;

                        if (Number(taxCalculationForm) != 4) {
                            reductionRatio = 1;
                        }

                        var isTaxNotIncluded = searchResultCC[i].getValue({
                            join: "custrecord_lmry_sub_type",
                            name: "custrecord_lmry_is_tax_not_included"
                        });

                        var isSubstitutionTax = searchResultCC[i].getValue({
                            name: "custrecord_lmry_ccl_is_substitution"
                        });

                        var taxItem = searchResultCC[i].getValue({
                            name: "custrecord_lmry_ar_ccl_taxitem"
                        });

                        var taxCode = searchResultCC[i].getValue({
                            name: "custrecord_lmry_ar_ccl_taxcode"
                        });

                        var faTaxRate = searchResultCC[i].getValue({
                            name: "custrecord_lmry_ccl_fa_tax_rate"
                        }) || 0.00;
                        faTaxRate = parseFloat(faTaxRate);

                        retencion = 0;
                        baseAmount = 0;
                        compareAmount = 0;

                        // Conversion de los montos de la CC a moneda de la transaccion
                        if (min_amount == null || min_amount == '') { // Entidad - Totales / Items - Minimo
                            min_amount = 0;
                        }
                        min_amount = parseFloat(parseFloat(min_amount) / exchangeRate);
                        if (max_amount == null || max_amount == '') { // Entidad - Totales / Items - Maximo
                            max_amount = 0;
                        }
                        max_amount = parseFloat(parseFloat(max_amount) / exchangeRate);
                        if (base_retention == null || base_retention == '') {
                            base_retention = 0;
                        }
                        base_retention = parseFloat(parseFloat(base_retention) / exchangeRate);
                        if (not_taxable_minimun == null || not_taxable_minimun == '') {
                            not_taxable_minimun = 0;
                        }
                        not_taxable_minimun = parseFloat(parseFloat(not_taxable_minimun) / exchangeRate);

                        if (ratio == null || ratio == '') {
                            ratio = 1;
                        }

                        var amount_to_compare = amount_to;

                        // Si es Suite GL y debe tomar las Cuentas de la CC y estas están vacias, continua con la siguiente iteracion
                        if (glimpact && typeTransaction != "itemfulfillment") {
                            if ((account1 == null || account1 == '') || (account2 == null || account2 == '')) {
                                continue;
                            }
                        }

                        if (description == null || description == '') {
                            description = '';
                        }

                        if ((applyWHT == true || applyWHT == 'T') && (isTaxByLocation == true || isTaxByLocation == 'T')) {
                            continue;
                        }

                        if ((isImportTax == "T" || isImportTax == true) && typeTransaction != "itemfulfillment") {

                            //Solo para flujo 3
                            if (Number(taxCalculationForm) != 4) {
                                continue;
                            }

                            //Se verifica si es extranjero
                            var entityCountry = search.lookupFields({
                                type: "vendor",
                                id: entity,
                                columns: ["custentity_lmry_country.custrecord_lmry_mx_country"]
                            });

                            entityCountry = entityCountry["custentity_lmry_country.custrecord_lmry_mx_country"];

                            if (!entityCountry || !entityCountry.length || Number(entityCountry[0]["value"]) == 30) {
                                continue;
                            }
                        }

                        // Caso 2I : Entidad - Items
                        if (rule_br) {
                            for (var j = 0; j < cantidad_items; j++) {
                                var idItem = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: j
                                });

                                var idItemName = recordObj.getSublistText({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: j
                                });

                                //Line Unique Key
                                var lineUniqueKey = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'lineuniquekey',
                                    line: j
                                }) || "";

                                var flagItem = false;

                                // Rule
                                var ruleItem = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_lmry_br_tax_rule',
                                    line: j
                                });
                                // Regimen
                                var regimenItem = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_lmry_br_regimen',
                                    line: j
                                });

                                var mcnCode = recordObj.getSublistValue({
                                    sublistId: "item",
                                    fieldId: "custcol_lmry_br_tran_mcn",
                                    line: j
                                }) || "";

                                var isTaxItem = recordObj.getSublistValue({
                                    sublistId: "item",
                                    fieldId: "custcol_lmry_ar_item_tributo",
                                    line: j
                                });

                                if (isTaxItem == "T" || isTaxItem == true) {
                                    continue;
                                }

                                var fixedAsset = "";
                                if (NS_FA_ACTIVE == true || NS_FA_ACTIVE == "T") {
                                    var faNSField = recordObj.getSublistField({
                                        sublistId: "item",
                                        fieldId: "custcol_far_trn_relatedasset",
                                        line: j
                                    });

                                    if (faNSField) {
                                        fixedAsset = recordObj.getSublistValue({
                                            sublistId: "item",
                                            fieldId: "custcol_far_trn_relatedasset",
                                            line: j
                                        }) || "";
                                    }
                                } else {
                                    fixedAsset = recordObj.getSublistValue({
                                        sublistId: "item",
                                        fieldId: "custcol_lmry_br_fixed_assets",
                                        line: j
                                    }) || "";
                                }

                                // Tax Situation
                                var taxSituationItem = 0;
                                switch (subtype_id) {
                                    case '10': // PIS
                                        taxSituationItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_lmry_br_cst_pis',
                                            line: j
                                        });
                                        break;
                                    case '11': // COFINS
                                        taxSituationItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_lmry_br_cst_cofins',
                                            line: j
                                        });
                                        break;
                                    case '24': // ICMS
                                        taxSituationItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_lmry_br_cst_icms',
                                            line: j
                                        });
                                        break;
                                    case '36': // IPI
                                        taxSituationItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_lmry_br_cst_ipi',
                                            line: j
                                        });
                                        break;
                                }
                                if (ruleItem == rule_br) {
                                    flagItem = true;
                                }

                                if (regimenItem == null || regimenItem == '' || regimenItem == 0) {
                                    regimenItem = regimen;
                                }

                                if (taxSituationItem == null || taxSituationItem == '' || taxSituationItem == 0) {
                                    taxSituationItem = taxSituation;
                                }


                                retencion = 0;
                                if (flagItem == true) {
                                    if (Number(taxCalculationForm) == 4 && typeTransaction != "itemfulfillment") {
                                        if (isSubstitutionTax == "T" || isSubstitutionTax == true) {
                                            var mvaList = getMVAByValues(mvaRecords, mcnCode, "", "", subtype_id, taxrate);
                                            if (mvaList.length) {
                                                for (var m = 0; m < mvaList.length; m++) {
                                                    var mvaId = mvaList[m]["mvaId"];
                                                    stTaxes[j] = stTaxes[j] || {};
                                                    stTaxes[j][mvaId] = stTaxes[j][mvaId] || [];
                                                    stTaxes[j][mvaId].push({
                                                        subType: subtype,
                                                        subTypeId: subtype_id,
                                                        taxRate: parseFloat(taxrate),
                                                        mvaRate: mvaRate,
                                                        taxRecordId: internalIdCC,
                                                        case: "2I",
                                                        receita: receita,
                                                        taxSituation: taxSituationItem,
                                                        natureRevenue: natureRevenue,
                                                        regimen: regimenItem,
                                                        taxItem: taxItem,
                                                        taxCode: taxCode,
                                                        faTaxRate: faTaxRate
                                                    });
                                                }
                                            }
                                            continue;
                                        }
                                    }

                                    if (typeTransaction != "itemfulfillment") {
                                        var grossamtItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'grossamt',
                                            line: j
                                        });
                                        var taxamtItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'tax1amt',
                                            line: j
                                        });
                                        var netamtItem = parseFloat(grossamtItem) - parseFloat(taxamtItem);
                                    } else {
                                        var quantity = recordObj.getSublistValue({ sublistId: "item", fieldId: "quantity", line: j }) || 0.00;
                                        var precUnit = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_prec_unit_so", line: j }) || 0.00;

                                        var grossamtItem = round2(parseFloat(quantity) * parseFloat(precUnit));
                                        var netamtItem = grossamtItem;
                                        var taxamtItem = 0.00;
                                    }

                                    if (taxamtItem == 0 && amount_to == 2) {
                                        continue;
                                    }

                                    var baseDifal = 0, baseFixedAsset = 0;

                                    // Brasil : Calculo del Monto Base
                                    if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Para el Flujo 0 y 2
                                        amount_to = '3'; // Trabaja con el Net Amount siempre
                                        var suma = parseFloat(sumaPorcentajes(searchResultCC, 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_br_ccl_rate_suma', 'custrecord_lmry_ccl_tax_rule', ruleItem, 'custrecord_lmry_sub_type'));
                                        // Realiza la formula del Monto Base siguiendo la formula "Monto Base = Monto / (1 - suma de porcentajes)"
                                        grossamtItem = parseFloat(grossamtItem / parseFloat(1 - suma));
                                        taxamtItem = parseFloat(taxamtItem / parseFloat(1 - suma));
                                        netamtItem = parseFloat(netamtItem / parseFloat(1 - suma));

                                        if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                                            var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                                            // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                                            grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                                            netamtItem = parseFloat(netamtItem) - parseFloat(sumaBaseCalculoI);
                                            taxamtItem = parseFloat(taxamtItem) - parseFloat(sumaBaseCalculoI);
                                        }
                                    } else { // Para el Flujo 1 y 3
                                        amount_to = '1'; // Trabaja con el Gross Amount siempre
                                        if (taxCalculationForm == 4) {
                                            baseDifal = grossamtItem;
                                            baseFixedAsset = grossamtItem;
                                            if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                                                var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                                                //si es un impuesto de telecomunicaciones se resta al gross(monto base), la suma de los otros impuestos(PIS, COFINS..)
                                                grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                                            }
                                        }
                                    }

                                    // Calculo del Monto Base
                                    switch (amount_to) {
                                        case '1':
                                            baseAmount = parseFloat(grossamtItem) - parseFloat(not_taxable_minimun);
                                            break;
                                        case '2':
                                            baseAmount = parseFloat(taxamtItem) - parseFloat(not_taxable_minimun);
                                            break;
                                        case '3':
                                            baseAmount = parseFloat(netamtItem) - parseFloat(not_taxable_minimun);
                                            break;
                                    }
                                    baseAmount = parseFloat(baseAmount);
                                    // Calculo del Monto a Comparar
                                    compareAmount = parseFloat(baseAmount);

                                    if (how_base_amount != null && how_base_amount != '') {
                                        switch (how_base_amount) {
                                            case '2': // Substrac Minimun
                                                baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                                                break;
                                            case '3': // Minimun
                                                baseAmount = parseFloat(min_amount);
                                                break;
                                            case '4': // Maximun
                                                baseAmount = parseFloat(max_amount);
                                                break;
                                            case '5': // Always Substrac Minimun
                                                baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                                                break;
                                        }
                                    }
                                    baseAmount = parseFloat(baseAmount);
                                    var originBaseAmount = baseAmount;

                                    if ((is_exclusive == "F" || is_exclusive == false) && reductionRatio != 1) {
                                        baseAmount = baseAmount * reductionRatio;
                                        baseAmount = round2(baseAmount);
                                    }

                                    if (baseAmount <= 0) {
                                        continue;
                                    }

                                    // Calculo de retencion
                                    if (max_amount != 0) {
                                        if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                                            retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                                        }
                                    } else {
                                        if (min_amount <= parseFloat(compareAmount)) {
                                            retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                                        }
                                    }

                                    if (parseFloat(retencion) > 0 || isExempt == true || parseFloat(taxrate) == 0) {
                                        var retencionAux = round2(retencion);
                                        if (parseFloat(retencion) > 0 || isExempt == true || parseFloat(taxrate) == 0) {
                                            var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                                            // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0, 2, 3
                                            if ((is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm) != -1)) {
                                                baseCalculoBR(parseFloat(retencion), j, true);
                                            }

                                            var baseNoTributada = 0, baseNoTributadaLocCurr = 0;
                                            if ((is_exclusive == "F" || is_exclusive == false) && (isReduction == true || isReduction == "T")) {
                                                baseNoTributada = round2(originBaseAmount - baseAmount);
                                                if (exchangeRate == 1) {
                                                    baseNoTributadaLocCurr = baseNoTributada
                                                } else {
                                                    baseNoTributadaLocCurr = round2(originBaseAmount) * exchangeRate - round2(baseAmount) * exchangeRate;
                                                }
                                            }

                                            var difalAmount = 0.00, difalFxAmount = 0.00, faTaxAmount = 0.00;
                                            var difalOrigen = '', difalDestination = '', difalAmountauto = 0.00;
                                            if (Number(taxCalculationForm) == 4) {
                                                if (difalActive) {
                                                    if (hasProvince && ArraySubtype.indexOf(subtype_id) > -1 && difalmatch && setupTax['difalAccount']) {
                                                        difalOrigen = province ? JsonProvinceRate[province] : JsonProvinceRate[provinceBRTranFields];
                                                        difalDestination = JsonProvinceRate[setupTax['province']];
                                                        var amtOri = (baseDifal * difalOrigen) / 100;
                                                        amtOri = Math.round(amtOri * 100) / 100;
                                                        var amtDes = (baseDifal * difalDestination) / 100;
                                                        amtDes = Math.round(amtDes * 100) / 100;
                                                        difalAmountauto = Math.abs(amtOri - amtDes);
                                                        if (exchangeRate != 1) {
                                                            difalAmountauto = round2(difalAmountauto) * exchangeRate;
                                                        }
                                                        log.debug('data test', [difalOrigen, difalDestination, amtOri, amtDes, difalAmountauto].join('|'));
                                                        var origenAmount = (baseDifal * difalOrigen) / 100;
                                                        var destinoAmount = (baseDifal * difalDestination) / 100;
                                                        //var account = recordObj.getValue('account');
                                                        //var subsi = recordObj.getValue('subsidiary') ? recordObj.getValue('subsidiary') : 1;
                                                        if (!ispreview) createJournalDifal(origenAmount, destinoAmount, setupTax, recordObj, subtype_id, j);
                                                    }
                                                } else {
                                                    if (difalTaxRate) {
                                                        difalFxAmount = parseFloat(baseDifal) * difalTaxRate;
                                                        difalAmount = difalFxAmount;
                                                        if (exchangeRate != 1) {
                                                            difalAmount = round2(difalAmount) * exchangeRate;
                                                        }
                                                    }
                                                }

                                                if (faTaxRate && fixedAsset) {
                                                    faTaxAmount = parseFloat(baseFixedAsset) * faTaxRate;
                                                    if (exchangeRate != 1) {
                                                        faTaxAmount = round2(faTaxAmount) * exchangeRate;
                                                    }
                                                }

                                                if (isSubstitutionTax == "F" || isSubstitutionTax == false) {
                                                    var mvaList = getMVAByValues(mvaRecords, mcnCode, subtype_id, taxrate);
                                                    if (mvaList.length) {
                                                        taxesToST[j] = taxesToST[j] || {};
                                                        for (var m = 0; m < mvaList.length; m++) {
                                                            var mvaId = mvaList[m]["mvaId"];
                                                            var mvaRate = mvaList[m]["mvaRate"];
                                                            taxesToST[j][mvaId] = taxesToST[j][mvaId] || [];
                                                            taxesToST[j][mvaId].push({
                                                                mvaRate: mvaRate,
                                                                subType: subtype_id,
                                                                taxRate: parseFloat(taxrate),
                                                                taxRecordId: internalIdCC
                                                            });
                                                        }
                                                    }
                                                }


                                                if (isTaxNotIncluded == "T" || isTaxNotIncluded == true) {
                                                    taxesNotIncluded[j] = taxesNotIncluded[j] || {};

                                                    if (!taxesNotIncluded[j][subtype_id]) {
                                                        taxesNotIncluded[j][subtype_id] = {
                                                            amount: 0.00,
                                                            subType: subtype,
                                                            subTypeId: subtype_id
                                                        }
                                                    }

                                                    taxesNotIncluded[j][subtype_id]["amount"] = taxesNotIncluded[j][subtype_id]["amount"] + retencion;

                                                }
                                            }

                                            jsonArray[j] = jsonArray[j] || [];

                                            jsonArray[j].push({
                                                subType: subtype,
                                                subTypeID: subtype_id,
                                                lineUniqueKey: lineUniqueKey,
                                                baseAmount: parseFloat(baseAmount),
                                                retencion: retencion,
                                                idCCNT: internalIdCC,
                                                taxRate: parseFloat(taxrate),
                                                caso: '2I',
                                                account1: account1,
                                                account2: account2,
                                                items: idItem,
                                                itemsName: idItemName,
                                                posicionItem: j,
                                                description: description,
                                                receita: receita,
                                                taxSituation: taxSituationItem,
                                                natureRevenue: natureRevenue,
                                                regimen: regimenItem,
                                                isExempt: isExempt,
                                                localCurrBaseAmt: exchangeRate == 1 ? parseFloat(baseAmount) : round2(parseFloat(baseAmount)) * exchangeRate,
                                                localCurrAmt: exchangeRate == 1 ? retencion : round2(retencion) * exchangeRate,
                                                localCurrGrossAmt: exchangeRate == 1 ? grossamtItem : round2(grossamtItem) * exchangeRate,
                                                difalAmount: difalAmount,
                                                difalTaxRate: difalTaxRate,
                                                difalFxAmount: round4(difalFxAmount),
                                                isApplyReport: isApplyReport,
                                                isImportTax: isImportTax,
                                                baseNoTributada: baseNoTributada,
                                                baseNoTributadaLocCurr: baseNoTributadaLocCurr,
                                                isSubstitutionTax: false,
                                                isTaxNotIncluded: isTaxNotIncluded,
                                                taxItem: taxItem,
                                                taxCode: taxCode,
                                                difalOrigen: difalOrigen,
                                                difalDestination: difalDestination,
                                                difalAmountauto: difalAmountauto,
                                                faTaxRate: faTaxRate,
                                                faTaxAmount: faTaxAmount,
                                                fixedAsset: (faTaxRate && !NS_FA_ACTIVE) ? fixedAsset : "",
                                                fixedAssetNS: (faTaxRate && NS_FA_ACTIVE) ? fixedAsset : ""
                                            });

                                            cantidad++;
                                            blnTaxCalculate = true;
                                        }
                                    } // Fin Retencion > 0
                                } // Fin FlagItem = true
                            } // Fin For de Items
                        } // Fin Caso 2I : Entidad - Items

                    }
                }

                /********************************************
                 * Consulta de Impuestos Exentos para Brasil
                 *******************************************/
                var filtroExemptBR = exemptTaxBR(entity);

                // Inicializa las variables para Brasil
                sumaBaseCalculoI = 0;
                arreglo_SumaBaseBR = new Array();
                arreglo_IndiceBaseBR = new Array();

                /****************************************************
                 * Busqueda en el record: LatamReady - National Taxes
                 ****************************************************/
                var filtrosNT = [
                    ["isinactive", "is", "F"], "AND",
                    ["custrecord_lmry_ntax_datefrom", "onorbefore", fecha], "AND",
                    ["custrecord_lmry_ntax_dateto", "onorafter", fecha], "AND",
                    ["custrecord_lmry_ntax_transactiontypes", "anyof", filtroTransactionType], "AND",
                    ["custrecord_lmry_ntax_taxtype", "anyof", "4"], "AND",
                    ["custrecord_lmry_ntax_appliesto", "anyof", "2"], "AND",
                    ["custrecord_lmry_ntax_gen_transaction", "anyof", "3"]
                ];

                var documents = ['@NONE@'];
                if (documentType) {
                    documents.push(documentType);
                }

                filtrosNT.push("AND", ["custrecord_lmry_ntax_fiscal_doctype", "anyof", documents]);

                if (featureSubs) {
                    filtrosNT.push("AND", ["custrecord_lmry_ntax_subsidiary", "anyof", subsidiary])
                }

                if (filtroExemptBR) {
                    filtrosNT.push("AND", ["custrecord_lmry_ntax_sub_type", "noneof", filtroExemptBR])
                }

                var provinces = ['@NONE@'];
                if (province) {
                    provinces.push(province);
                }

                var cities = ['@NONE@'];
                if (city) {
                    cities.push(city)
                }

                var districts = ['@NONE@'];
                if (district) {
                    districts.push(district);
                }

                filtrosNT.push('AND', [
                    [
                        ["custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "is", "F"]
                    ]
                    , "OR", [
                        ["custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "is", "T"],
                        "AND", ["custrecord_lmry_ntax_province", "anyof", provinces],
                        "AND", ["custrecord_lmry_ntax_city", "anyof", cities],
                        "AND", ["custrecord_lmry_ntax_district", "anyof", districts]
                    ]
                ]);


                var searchNT = search.create({
                    type: 'customrecord_lmry_national_taxes',
                    columns: [{
                        name: 'custrecord_lmry_ntax_tax_rule',
                        sort: search.Sort.ASC
                    }, {
                        name: 'custrecord_lmry_br_ntax_exclusive',
                        sort: search.Sort.ASC
                    }, 'internalid',
                    'custrecord_lmry_ntax_taxrate',
                    'custrecord_lmry_ntax_amount',
                    'custrecord_lmry_ntax_sub_type',
                        'custrecord_lmry_ntax_minamount',
                        'custrecord_lmry_ntax_debit_account',
                        'custrecord_lmry_ntax_credit_account',
                        'custrecord_lmry_ntax_gl_impact',
                        'custrecord_lmry_ntax_addratio',
                        'custrecord_lmry_ntax_description',
                        'custrecord_lmry_ntax_maxamount',
                        'custrecord_lmry_ntax_not_taxable_minimum',
                        'custrecord_lmry_ntax_base_amount',
                        'custrecord_lmry_ntax_set_baseretention',
                        'custrecord_lmry_br_ntax_rate_suma',
                        'custrecord_lmry_ntax_br_receita',
                        'custrecord_lmry_ntax_isexempt',
                        'custrecord_lmry_br_ntax_tax_situation',
                        'custrecord_lmry_br_ntax_nature_revenue',
                        'custrecord_lmry_br_ntax_regimen_catalog',
                        'custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location',
                        'custrecord_lmry_ntax_difal',
                        'custrecord_lmry_ntax_sub_type.custrecord_lmry_br_is_import_tax',
                        'custrecord_lmry_nt_br_apply_report',
                        'custrecord_lmry_nt_is_reduction', 'custrecord_lmry_nt_reduction_ratio',
                        'custrecord_lmry_ntax_sub_type.custrecord_lmry_is_tax_not_included',
                        'custrecord_lmry_nt_is_substitution',
                        'custrecord_lmry_ntax_taxitem',
                        'custrecord_lmry_ntax_taxcode',
                        'custrecord_lmry_ntax_fa_tax_rate'
                    ],
                    filters: filtrosNT
                });
                var searchResultNT = searchNT.run().getRange({
                    start: 0,
                    end: 1000
                });

                log.debug('LBRY - searchResultNT', searchResultNT.length);
                if (searchResultNT != null && searchResultNT.length > 0) {

                    for (var i = 0; i < searchResultNT.length; i++) {
                        var internalIdNT = searchResultNT[i].getValue({
                            name: 'internalid'
                        });
                        var taxrate = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_taxrate'
                        });
                        var amount_to = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_amount'
                        });
                        var subtype = searchResultNT[i].getText({
                            name: 'custrecord_lmry_ntax_sub_type'
                        });

                        var subtype_id = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_sub_type'
                        });
                        var min_amount = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_minamount'
                        });
                        var max_amount = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_maxamount'
                        });
                        var account1 = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_debit_account'
                        });
                        var account2 = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_credit_account'
                        });
                        var rule_br = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_tax_rule'
                        });
                        var ratio = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_addratio'
                        });
                        var description = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_description'
                        });
                        var not_taxable_minimun = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_not_taxable_minimum'
                        });
                        var how_base_amount = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_base_amount'
                        });
                        var base_retention = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_set_baseretention'
                        });
                        var is_exclusive = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_br_ntax_exclusive'
                        });
                        var glimpact = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_gl_impact'
                        });
                        var receita = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_br_receita'
                        });
                        var isExempt = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_ntax_isexempt'
                        });
                        var taxSituation = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_br_ntax_tax_situation'
                        });
                        var natureRevenue = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_br_ntax_nature_revenue'
                        });
                        var regimen = searchResultNT[i].getValue({
                            name: 'custrecord_lmry_br_ntax_regimen_catalog'
                        });

                        var isTaxByLocation = searchResultNT[i].getValue({
                            join: "custrecord_lmry_ntax_sub_type",
                            name: "custrecord_lmry_tax_by_location"
                        });

                        var difalTaxRate = searchResultNT[i].getValue({
                            name: "custrecord_lmry_ntax_difal"
                        }) || 0.00;
                        difalTaxRate = parseFloat(difalTaxRate);

                        var isImportTax = searchResultNT[i].getValue({
                            join: "custrecord_lmry_ntax_sub_type",
                            name: "custrecord_lmry_br_is_import_tax"
                        });

                        var isApplyReport = searchResultNT[i].getValue({
                            name: "custrecord_lmry_nt_br_apply_report"
                        });

                        var isReduction = searchResultNT[i].getValue({
                            name: "custrecord_lmry_nt_is_reduction"
                        });

                        var reductionRatio = searchResultNT[i].getValue({
                            name: "custrecord_lmry_nt_reduction_ratio"
                        }) || 1;

                        if (Number(taxCalculationForm) != 4) {
                            reductionRatio = 1;
                        }

                        var isTaxNotIncluded = searchResultNT[i].getValue({
                            join: "custrecord_lmry_ntax_sub_type",
                            name: "custrecord_lmry_is_tax_not_included"
                        });

                        var isSubstitutionTax = searchResultNT[i].getValue({
                            name: "custrecord_lmry_nt_is_substitution"
                        });

                        var taxItem = searchResultNT[i].getValue({
                            name: "custrecord_lmry_ntax_taxitem"
                        });

                        var taxCode = searchResultNT[i].getValue({
                            name: "custrecord_lmry_ntax_taxcode"
                        });

                        var faTaxRate = searchResultNT[i].getValue({
                            name: "custrecord_lmry_ntax_fa_tax_rate"
                        }) || 0.00;
                        faTaxRate = parseFloat(faTaxRate);
                        retencion = 0;
                        baseAmount = 0;
                        compareAmount = 0;

                        // Conversion de los montos de la CC a moneda de la transaccion
                        if (min_amount == null || min_amount == '') { // Subsidiaria - Totales / Items - Minimo
                            min_amount = 0;
                        }
                        min_amount = parseFloat(parseFloat(min_amount) / exchangeRate);

                        if (max_amount == null || max_amount == '') { // Subsidiaria - Totales / Items - Maximo
                            max_amount = 0;
                        }
                        max_amount = parseFloat(parseFloat(max_amount) / exchangeRate);
                        if (base_retention == null || base_retention == '') {
                            base_retention = 0;
                        }
                        base_retention = parseFloat(parseFloat(base_retention) / exchangeRate);
                        if (not_taxable_minimun == null || not_taxable_minimun == '') {
                            not_taxable_minimun = 0;
                        }
                        not_taxable_minimun = parseFloat(parseFloat(not_taxable_minimun) / exchangeRate);

                        if (ratio == null || ratio == '') {
                            ratio = 1;
                        }

                        var amount_to_compare = amount_to;


                        // Si es Suite GL y debe tomar las Cuentas de la CC y estas están vacias, continua con la siguiente iteracion
                        if (glimpact && typeTransaction != "itemfulfillment") {
                            if ((account1 == null || account1 == '') || (account2 == null || account2 == '')) {
                                continue;
                            }
                        }

                        if (description == null || description == '') {
                            description = '';
                        }

                        if ((applyWHT == true || applyWHT == 'T') && (isTaxByLocation == true || isTaxByLocation == 'T')) {
                            continue;
                        }

                        if ((isImportTax == "T" || isImportTax == true) && typeTransaction != "itemfulfillment") {
                            //Solo para flujo 3
                            if (Number(taxCalculationForm) != 4) {
                                continue;
                            }
                            //Se verifica si es extranjero
                            var entityCountry = search.lookupFields({
                                type: "vendor",
                                id: entity,
                                columns: ["custentity_lmry_country.custrecord_lmry_mx_country"]
                            });

                            entityCountry = entityCountry["custentity_lmry_country.custrecord_lmry_mx_country"];

                            if (!entityCountry || !entityCountry.length || Number(entityCountry[0]["value"]) == 30) {
                                continue;
                            }
                        }

                        // Caso 4I : Subsidiaria - Items
                        if (rule_br) {
                            for (var j = 0; j < cantidad_items; j++) {
                                var idItem = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: j
                                });

                                var idItemName = recordObj.getSublistText({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: j
                                });

                                var lineUniqueKey = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'lineuniquekey',
                                    line: j
                                }) || "";

                                var flagItem = false;

                                // Rule
                                var ruleItem = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_lmry_br_tax_rule',
                                    line: j
                                });
                                // Regimen
                                var regimenItem = recordObj.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_lmry_br_regimen',
                                    line: j
                                });

                                var mcnCode = recordObj.getSublistValue({
                                    sublistId: "item",
                                    fieldId: "custcol_lmry_br_tran_mcn",
                                    line: j
                                }) || "";

                                var isTaxItem = recordObj.getSublistValue({
                                    sublistId: "item",
                                    fieldId: "custcol_lmry_ar_item_tributo",
                                    line: j
                                });

                                if (isTaxItem == "T" || isTaxItem == true) {
                                    continue;
                                }

                                var fixedAsset = "";
                                if (NS_FA_ACTIVE == true || NS_FA_ACTIVE == "T") {
                                    var faNSField = recordObj.getSublistField({
                                        sublistId: "item",
                                        fieldId: "custcol_far_trn_relatedasset",
                                        line: j
                                    });

                                    if (faNSField) {
                                        fixedAsset = recordObj.getSublistValue({
                                            sublistId: "item",
                                            fieldId: "custcol_far_trn_relatedasset",
                                            line: j
                                        }) || "";
                                    }
                                } else {
                                    fixedAsset = recordObj.getSublistValue({
                                        sublistId: "item",
                                        fieldId: "custcol_lmry_br_fixed_assets",
                                        line: j
                                    }) || "";
                                }

                                // Tax Situation
                                var taxSituationItem = 0;
                                switch (subtype_id) {
                                    case '10': // PIS
                                        taxSituationItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_lmry_br_cst_pis',
                                            line: j
                                        });
                                        break;
                                    case '11': // COFINS
                                        taxSituationItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_lmry_br_cst_cofins',
                                            line: j
                                        });
                                        break;
                                    case '24': // ICMS
                                        taxSituationItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_lmry_br_cst_icms',
                                            line: j
                                        });
                                        break;
                                    case '36': // IPI
                                        taxSituationItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_lmry_br_cst_ipi',
                                            line: j
                                        });
                                        break;
                                }

                                if (ruleItem == rule_br) {
                                    flagItem = true;
                                }

                                if (regimenItem == null || regimenItem == '' || regimenItem == 0) {
                                    regimenItem = regimen;
                                }

                                if (taxSituationItem == null || taxSituationItem == '' || taxSituationItem == 0) {
                                    taxSituationItem = taxSituation;
                                }

                                retencion = 0;
                                if (flagItem == true) {
                                    if (Number(taxCalculationForm) == 4 && typeTransaction != "itemfulfillment") {
                                        if (isSubstitutionTax == "T" || isSubstitutionTax == true) {
                                            var mvaList = getMVAByValues(mvaRecords, mcnCode, "", "", subtype_id, taxrate);
                                            if (mvaList.length) {
                                                for (var m = 0; m < mvaList.length; m++) {
                                                    var mvaId = mvaList[m]["mvaId"];
                                                    stTaxes[j] = stTaxes[j] || {};
                                                    stTaxes[j][mvaId] = stTaxes[j][mvaId] || [];
                                                    stTaxes[j][mvaId].push({
                                                        subType: subtype,
                                                        subTypeId: subtype_id,
                                                        taxRate: parseFloat(taxrate),
                                                        mvaRate: mvaRate,
                                                        taxRecordId: internalIdNT,
                                                        case: "4I",
                                                        receita: receita,
                                                        taxSituation: taxSituationItem,
                                                        natureRevenue: natureRevenue,
                                                        regimen: regimenItem,
                                                        taxItem: taxItem,
                                                        taxCode: taxCode,
                                                        faTaxRate: faTaxRate
                                                    });
                                                }
                                            }
                                            continue;
                                        }
                                    }


                                    if (typeTransaction != "itemfulfillment") {
                                        var grossamtItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'grossamt',
                                            line: j
                                        });
                                        var taxamtItem = recordObj.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'tax1amt',
                                            line: j
                                        });
                                        var netamtItem = parseFloat(grossamtItem) - parseFloat(taxamtItem);
                                    } else {
                                        var quantity = recordObj.getSublistValue({ sublistId: "item", fieldId: "quantity", line: j }) || 0.00;
                                        var precUnit = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_prec_unit_so", line: j }) || 0.00;

                                        var grossamtItem = round2(parseFloat(quantity) * parseFloat(precUnit));
                                        var netamtItem = grossamtItem;
                                        var taxamtItem = 0.00;
                                    }

                                    if (taxamtItem == 0 && amount_to == 2) {
                                        continue;
                                    }


                                    var baseDifal = 0, baseFixedAsset = 0;

                                    // Brasil : Calculo del Monto Base
                                    if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Para el Flujo 0 y 2
                                        amount_to = '3'; // Trabaja con el Net Amount siempre
                                        var suma = sumaPorcentajes(searchResultNT, 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_br_ntax_rate_suma', 'custrecord_lmry_ntax_tax_rule', ruleItem, 'custrecord_lmry_ntax_sub_type')
                                        // Realiza la formula del Monto Base siguiendo la formula "Monto Base = Monto / (1 - suma de porcentajes)"
                                        grossamtItem = parseFloat(grossamtItem / parseFloat(1 - suma));
                                        taxamtItem = parseFloat(taxamtItem / parseFloat(1 - suma));
                                        netamtItem = parseFloat(netamtItem / parseFloat(1 - suma));

                                        if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                                            var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                                            // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                                            grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                                            netamtItem = parseFloat(netamtItem) - parseFloat(sumaBaseCalculoI);
                                            taxamtItem = parseFloat(taxamtItem) - parseFloat(sumaBaseCalculoI);
                                        }
                                    } else { // Para el Flujo 1 y 3
                                        amount_to = '1'; // Trabaja con el Gross Amount siempre
                                        if (taxCalculationForm == 4) {
                                            baseDifal = grossamtItem;
                                            baseFixedAsset = grossamtItem;
                                            if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                                                var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                                                //si es un impuesto de telecomunicaciones se resta al gross(monto base), la suma de los otros impuestos(PIS, COFINS..)
                                                grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                                            }
                                        }
                                    }

                                    // Calculo del Monto Base
                                    switch (amount_to) {
                                        case '1':
                                            baseAmount = parseFloat(grossamtItem) - parseFloat(not_taxable_minimun);
                                            break;
                                        case '2':
                                            baseAmount = parseFloat(taxamtItem) - parseFloat(not_taxable_minimun);
                                            break;
                                        case '3':
                                            baseAmount = parseFloat(netamtItem) - parseFloat(not_taxable_minimun);
                                            break;
                                    }
                                    baseAmount = parseFloat(baseAmount);

                                    // Calculo del Monto a Comparar
                                    compareAmount = parseFloat(baseAmount);

                                    if (how_base_amount != null && how_base_amount != '') {
                                        switch (how_base_amount) {
                                            case '2': // Substrac Minimun
                                                baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                                                break;
                                            case '3': // Minimun
                                                baseAmount = parseFloat(min_amount);
                                                break;
                                            case '4': // Maximun
                                                baseAmount = parseFloat(max_amount);
                                                break;
                                            case '5': // Always Substrac Minimun
                                                baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                                                break;
                                        }
                                    }
                                    baseAmount = parseFloat(baseAmount);
                                    var originBaseAmount = baseAmount;

                                    if ((is_exclusive == "F" || is_exclusive == false) && (reductionRatio != 1)) {
                                        baseAmount = baseAmount * reductionRatio;
                                        baseAmount = round2(baseAmount);
                                    }

                                    if (baseAmount <= 0) {
                                        continue;
                                    }

                                    // Calculo de retencion
                                    if (max_amount != 0) {
                                        if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                                            retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                                        }
                                    } else {
                                        if (min_amount <= parseFloat(compareAmount)) {
                                            retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                                        }
                                    }

                                    if (parseFloat(retencion) > 0 || isExempt == true || parseFloat(taxrate) == 0) {
                                        var retencionAux = round2(retencion)
                                        if (parseFloat(retencion) > 0 || isExempt == true || parseFloat(taxrate) == 0) {
                                            var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                                            // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0, 2, 3
                                            if ((is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm) != -1)) {
                                                baseCalculoBR(parseFloat(retencion), j, true);
                                            }

                                            var baseNoTributada = 0, baseNoTributadaLocCurr = 0;
                                            if ((is_exclusive == "F" || is_exclusive == false) && (isReduction == true || isReduction == "T")) {
                                                baseNoTributada = round2(originBaseAmount - baseAmount);
                                                if (exchangeRate == 1) {
                                                    baseNoTributadaLocCurr = baseNoTributada
                                                } else {
                                                    baseNoTributadaLocCurr = round2(originBaseAmount) * exchangeRate - round2(baseAmount) * exchangeRate;
                                                }
                                            }

                                            var difalAmount = 0.00, difalFxAmount = 0.00, faTaxAmount = 0.00;
                                            var difalOrigen = '', difalDestination = '', difalAmountauto = 0.00;
                                            if (Number(taxCalculationForm) == 4) {
                                                if (difalActive) {
                                                    if (hasProvince && ArraySubtype.indexOf(subtype_id) > -1 && difalmatch && setupTax['difalAccount']) {
                                                        difalOrigen = province ? JsonProvinceRate[province] : JsonProvinceRate[provinceBRTranFields];
                                                        difalDestination = JsonProvinceRate[setupTax['province']];
                                                        var amtOri = (baseDifal * difalOrigen) / 100;
                                                        amtOri = Math.round(amtOri * 100) / 100;
                                                        var amtDes = (baseDifal * difalDestination) / 100;
                                                        amtDes = Math.round(amtDes * 100) / 100;
                                                        difalAmountauto = Math.abs(amtOri - amtDes);
                                                        if (exchangeRate != 1) {
                                                            difalAmountauto = round2(difalAmountauto) * exchangeRate;
                                                        }
                                                        log.debug('data test', [difalOrigen, difalDestination, amtOri, amtDes, difalAmountauto].join('|'));
                                                        var origenAmount = (baseDifal * difalOrigen) / 100;
                                                        var destinoAmount = (baseDifal * difalDestination) / 100;
                                                        //var account = recordObj.getValue('account');
                                                        //var subsi = recordObj.getValue('subsidiary') ? recordObj.getValue('subsidiary') : 1;
                                                        if (!ispreview) createJournalDifal(origenAmount, destinoAmount, setupTax, recordObj, subtype_id, j);
                                                    }
                                                } else {
                                                    if (difalTaxRate) {
                                                        difalFxAmount = parseFloat(baseDifal) * difalTaxRate;
                                                        difalAmount = difalFxAmount;
                                                        if (exchangeRate != 1) {
                                                            difalAmount = round2(difalAmount) * exchangeRate;
                                                        }
                                                    }
                                                }

                                                if (faTaxRate && fixedAsset) {
                                                    faTaxAmount = parseFloat(baseFixedAsset) * faTaxRate;
                                                    if (exchangeRate != 1) {
                                                        faTaxAmount = round2(faTaxAmount) * exchangeRate;
                                                    }
                                                }

                                                if (isSubstitutionTax == "F" || isSubstitutionTax == false) {
                                                    var mvaList = getMVAByValues(mvaRecords, mcnCode, subtype_id, taxrate);
                                                    if (mvaList.length) {
                                                        taxesToST[j] = taxesToST[j] || {};
                                                        for (var m = 0; m < mvaList.length; m++) {
                                                            var mvaId = mvaList[m]["mvaId"];
                                                            var mvaRate = mvaList[m]["mvaRate"];
                                                            taxesToST[j][mvaId] = taxesToST[j][mvaId] || [];
                                                            taxesToST[j][mvaId].push({
                                                                mvaRate: mvaRate,
                                                                subType: subtype_id,
                                                                taxRate: parseFloat(taxrate),
                                                                taxRecordId: internalIdNT
                                                            });
                                                        }
                                                    }
                                                }

                                                if (isTaxNotIncluded == "T" || isTaxNotIncluded == true) {

                                                    taxesNotIncluded[j] = taxesNotIncluded[j] || {};

                                                    if (!taxesNotIncluded[j][subtype_id]) {
                                                        taxesNotIncluded[j][subtype_id] = {
                                                            amount: 0.00,
                                                            subType: subtype,
                                                            subTypeId: subtype_id
                                                        }
                                                    }

                                                    taxesNotIncluded[j][subtype_id]["amount"] = taxesNotIncluded[j][subtype_id]["amount"] + retencion;
                                                }
                                            }

                                            jsonArray[j] = jsonArray[j] || [];

                                            jsonArray[j].push({
                                                subType: subtype,
                                                subTypeID: subtype_id,
                                                lineUniqueKey: lineUniqueKey,
                                                baseAmount: parseFloat(baseAmount),
                                                retencion: retencion,
                                                idCCNT: internalIdNT,
                                                taxRate: parseFloat(taxrate),
                                                caso: '4I',
                                                account1: account1,
                                                account2: account2,
                                                items: idItem,
                                                itemsName: idItemName,
                                                posicionItem: j,
                                                description: description,
                                                receita: receita,
                                                taxSituation: taxSituationItem,
                                                natureRevenue: natureRevenue,
                                                regimen: regimenItem,
                                                isExempt: isExempt,
                                                localCurrBaseAmt: exchangeRate == 1 ? parseFloat(baseAmount) : round2(parseFloat(baseAmount)) * exchangeRate,
                                                localCurrAmt: exchangeRate == 1 ? retencion : round2(retencion) * exchangeRate,
                                                localCurrGrossAmt: exchangeRate == 1 ? grossamtItem : round2(grossamtItem) * exchangeRate,
                                                difalAmount: difalAmount,
                                                difalTaxRate: difalTaxRate,
                                                difalFxAmount: round4(difalFxAmount),
                                                isApplyReport: isApplyReport,
                                                isImportTax: isImportTax,
                                                baseNoTributada: baseNoTributada,
                                                baseNoTributadaLocCurr: baseNoTributadaLocCurr,
                                                isSubstitutionTax: false,
                                                isTaxNotIncluded: isTaxNotIncluded,
                                                taxItem: taxItem,
                                                taxCode: taxCode,
                                                difalOrigen: difalOrigen,
                                                difalDestination: difalDestination,
                                                difalAmountauto: difalAmountauto,
                                                faTaxRate: faTaxRate,
                                                faTaxAmount: faTaxAmount,
                                                fixedAsset: (faTaxRate && !NS_FA_ACTIVE) ? fixedAsset : "",
                                                fixedAssetNS: (faTaxRate && NS_FA_ACTIVE) ? fixedAsset : ""
                                            });
                                            cantidad++;
                                            blnTaxCalculate = true;
                                        }
                                    } // Fin Retencion > 0
                                } // Fin FlagItem = true
                            } // Fin For de Items
                        } // Fin Caso 4I : Subsidiaria - Items

                    }
                }

                if (Number(taxCalculationForm) == 4 && typeTransaction != "itemfulfillment") {
                    log.debug("taxesToST", JSON.stringify(taxesToST));
                    log.debug("stTaxes", JSON.stringify(stTaxes));
                    log.debug("taxesNotIncluded", JSON.stringify(taxesNotIncluded));
                    calculateSubstitutionTaxes(recordObj, taxesToST, stTaxes, taxesNotIncluded, jsonArray, exchangeRate);
                }
                for (var index in jsonArray) {
                    log.debug('LBRY - jsonArray[' + index + ']', jsonArray[index].length);
                }
                /*log.debug('LBRY - cantidad', cantidad);
                log.debug('LBRY - terminar', 'antes terminar');*/
                //recordObj.save({ disableTriggers: true, ignoreMandatoryFields: true });
            } catch (error) {
                log.error('LBRY', error);
                lbryLog.doLog({ title: "[ getTaxPurchase ]", message: error, relatedScript: "LMRY_BR_LatamTax_Purchase_LBRY_V2.0.js" });
                return {};
            }

            return jsonArray;
        }


        /*************************************************************************
         * Funcion que redondea o trunca los montos dependiendo de la
         * configuración en el récord "LatamReady - Setup Tax Subsidiary"
         * Parámetros :
         *      ret : monto a Redondear / Truncar
         *      rounding : 1: Redondear, 2: Truncar, Vacío: Mantener dos decimales
         *************************************************************************/
        function typeRounding(ret, rounding) {
            var retAux = round2(ret);
            var decimal;
            switch (rounding) {
                case '1': // Redondear
                    decimal = parseFloat(ret) - parseInt(ret);
                    if (decimal < 0.5) {
                        retAux = parseInt(ret);
                    } else {
                        retAux = parseInt(ret) + 1;
                    }
                    break;
                case '2': // Truncar
                    retAux = parseInt(ret);
                    break;
            }
            retAux = round2(retAux);
            return retAux;
        }

        /***********************************************************************************
         * Funcion que realiza la suma de Porcentajes para calcular el monto base
         * (Pais: Brasil)
         * Parámetros :
         *      searchResultCC_NT : Busqueda de la CC o NT
         *      caso : 1: Caso Totales, 2I: Caso Items
         *      id_appliesto, id_taxrate, id_taxrateSuma : Id's de los campos de la CC o NT
         *      id_line, id_catalogItem : id de la línea / catalogo del item
         ***********************************************************************************/
        function sumaPorcentajes(searchResultCC_NT, id_taxrate, id_taxrateSuma, id_line, id_ruleItem, subtype) {

            try {
                var sumaPorc = parseFloat(0);
                for (var i = 0; i < searchResultCC_NT.length; i++) {
                    var taxrateBR = searchResultCC_NT[i].getValue({
                        name: id_taxrate
                    });
                    var taxrateSuma = searchResultCC_NT[i].getValue({
                        name: id_taxrateSuma
                    });

                    var isTaxByLocation = searchResultCC_NT[i].getValue({
                        join: subtype,
                        name: "custrecord_lmry_tax_by_location"
                    });

                    if ((isTaxByLocation == true || isTaxByLocation == 'T') && (applyWHT == true || applyWHT == 'T')) {
                        continue;
                    }

                    if (taxrateSuma != '' && taxrateSuma != null) {
                        taxrateBR = parseFloat(taxrateSuma) / 100;
                    }

                    var ruleItemBR = searchResultCC_NT[i].getValue({
                        name: id_line
                    });
                    if (ruleItemBR != '' && ruleItemBR != null && ruleItemBR == id_ruleItem) {
                        sumaPorc = parseFloat(sumaPorc + parseFloat(taxrateBR));
                    }

                }
                return parseFloat(sumaPorc);
            } catch (err) {
                library.sendemail(' [ sumaPorcentajes ] ' + err, LMRY_script);
                lbryLog.doLog({ title: "[ sumaPorcentajes ]", message: err, relatedScript: "LMRY_BR_LatamTax_Purchase_LBRY_V2.0.js" });
            }
        }

        /***************************************************************************
         * Funcion que realiza la sumatoria de los Impuestos No Excluyentes para la
         * formula del Monto Base de los Impuestos Excluyentes (Pais: Brasil)
         * Parámetros :
         *      retencionBR : impuesto calculado
         *      n : línea del item
         *      blnBR : False: Impuesto Excluyente , True: Impuesto no Excluyente
         **************************************************************************/
        function baseCalculoBR(retencionBR, n, blnBR) {

            if (arreglo_IndiceBaseBR.length != 0) {
                for (var k = 0; k < arreglo_IndiceBaseBR.length; k++) {
                    if (arreglo_IndiceBaseBR[k] == n) {
                        if (blnBR == true) { // Inserta la sumatoria de los No Excluyentes
                            arreglo_SumaBaseBR[k] = parseFloat(arreglo_SumaBaseBR[k]) + parseFloat(retencionBR);
                            return 0;
                        } else { // Obtiene la suma de los No Excluyentes almacenada
                            return arreglo_SumaBaseBR[k];
                        }
                    }
                }
            }
            arreglo_IndiceBaseBR.push(n);
            arreglo_SumaBaseBR.push(parseFloat(retencionBR));
            return 0;
        }

        /*************************************************************
         * Funcion que concatena los Impuestos Exentos para un cliente
         * (Pais: Brasil)
         * Parámetros :
         *      entityID : ID del Cliente
         *************************************************************/
        function exemptTaxBR(entityID) {
            var exempts = [];
            var exemptTax = search.lookupFields({
                type: 'customer',
                id: entityID,
                columns: ['custentity_lmry_br_exempt_tax']
            }).custentity_lmry_br_exempt_tax;

            if (exemptTax) {
                for (var i = 0; i < exemptTax.length; i++) {
                    exempts.push(exemptTax[i].value);
                }
            }
            return (exempts.length) ? exempts : "";
        }




        function cleanLinesforCopy(RCD_TRANS) {
            try {
                var numLineas = RCD_TRANS.getLineCount({
                    sublistId: 'item'
                });

                var featureMultiPrice = runtime.isFeatureInEffect({ feature: 'multprice' });

                RCD_TRANS.setValue({ fieldId: 'custbody_lmry_informacion_adicional', value: '' });

                for (var i = 0; i < numLineas; i++) {

                    var isItemTax = RCD_TRANS.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_ar_item_tributo', line: i });
                    if (!isItemTax || isItemTax == 'F') {
                        RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_taxc_rsp', i, '');

                        if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_freight_val', line: i })) {
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_freight_val', i, '');
                        }

                        if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_insurance_val', line: i })) {
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_insurance_val', i, '');
                        }

                        if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_expens_val', line: i })) {
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_expens_val', i, '');
                        }

                        var base_amount = RCD_TRANS.getSublistValue('item', 'custcol_lmry_br_base_amount', i); //base_amount es el nuevo net
                        if (base_amount) {
                            var quantityItem = RCD_TRANS.getSublistValue('item', 'quantity', i);
                            quantityItem = parseFloat(quantityItem);
                            var rateItem = parseFloat(base_amount) / quantityItem;

                            if (featureMultiPrice == true || featureMultiPrice == 'T') {
                                RCD_TRANS.setSublistValue('item', 'price', i, -1);
                            }
                            RCD_TRANS.setSublistValue('item', 'rate', i, round2(rateItem));
                            RCD_TRANS.setSublistValue('item', 'amount', i, round2(base_amount));
                            RCD_TRANS.setSublistValue('item', 'taxrate1', i, '0%');
                            RCD_TRANS.setSublistValue('item', 'tax1amt', i, 0);
                            RCD_TRANS.setSublistValue('item', 'grossamt', i, round2(base_amount));
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_base_amount', i, '');
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_total_impuestos', i, '');
                        }
                    }
                }

                deleteTaxLines(RCD_TRANS);

            } catch (error) {
                log.error('[cleanLinesforCopy]', error);
                lbryLog.doLog({ title: "[ cleanLinesforCopy ]", message: error, relatedScript: "LMRY_BR_LatamTax_Purchase_LBRY_V2.0.js" });
            }
            return true;
        }

        function createTaxResult(JsonData, recordObj, difalActive) {
            try {
                var arrayTR = [];
                var concatenadoAccountBooks = concatenarAccountingBooks(recordObj);

                /****************************************************************************
                 * Agrega las lineas al record LatamReady - Tax Results y genera los Journals
                 ****************************************************************************/
                for (var pos in JsonData) {
                    for (var i = 0; i < JsonData[pos].length; i++) {
                        var recordSummary = record.create({
                            type: 'customrecord_lmry_br_transaction',
                            isDynamic: false
                        });
                        var idTransaction = parseFloat(recordObj.id);
                        idTransaction = idTransaction + "";

                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_related_id',
                            value: idTransaction
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_transaction',
                            value: idTransaction
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_type',
                            value: JsonData[pos][i].subType
                        });

                        if (JsonData[pos][i].subTypeID) {
                            recordSummary.setValue({
                                fieldId: 'custrecord_lmry_br_type_id',
                                value: JsonData[pos][i].subTypeID
                            });
                        }
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_base_amount',
                            value: round4(JsonData[pos][i].baseAmount)
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_total',
                            value: round4(parseFloat(JsonData[pos][i].retencion))
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_percent',
                            value: JsonData[pos][i].taxRate
                        });

                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_total_item',
                            value: 'Line - Item'
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_item',
                            value: JsonData[pos][i].items
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_positem',
                            value: parseInt(JsonData[pos][i].posicionItem)
                        });

                        //Line Unique Key
                        if (JsonData[pos][i]["lineUniqueKey"]) {
                            recordSummary.setValue({
                                fieldId: 'custrecord_lmry_lineuniquekey',
                                value: parseInt(JsonData[pos][i].lineUniqueKey)
                            });
                        }


                        if (JsonData[pos][i].caso == '2I') { // Entidad - Items
                            recordSummary.setValue({
                                fieldId: 'custrecord_lmry_ccl',
                                value: JsonData[pos][i].idCCNT
                            });
                            recordSummary.setValue({
                                fieldId: 'custrecord_lmry_br_ccl',
                                value: JsonData[pos][i].idCCNT
                            });
                        } else { // Subsidiaria - Items
                            recordSummary.setValue({
                                fieldId: 'custrecord_lmry_ntax',
                                value: JsonData[pos][i].idCCNT
                            });
                            recordSummary.setValue({
                                fieldId: 'custrecord_lmry_br_ccl',
                                value: JsonData[pos][i].idCCNT
                            });
                        }

                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_accounting_books',
                            value: concatenadoAccountBooks
                        });

                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_tax_description',
                            value: JsonData[pos][i].description
                        });

                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_total_base_currency',
                            value: round4(JsonData[pos][i].localCurrAmt)
                        });

                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_tax_type',
                            value: '4'
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_receta',
                            value: JsonData[pos][i].receita
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_tax_taxsituation',
                            value: JsonData[pos][i].taxSituation
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_tax_nature_revenue',
                            value: JsonData[pos][i].natureRevenue
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_regimen_asoc_catalog',
                            value: JsonData[pos][i].regimen
                        });

                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_created_from_script',
                            value: 1
                        });

                        if (JsonData[pos][i].localCurrBaseAmt) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_base_amount_local_currc", value: JsonData[pos][i].localCurrBaseAmt });
                        }
                        if (JsonData[pos][i].localCurrAmt) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_amount_local_currency", value: JsonData[pos][i].localCurrAmt })
                        }
                        if (JsonData[pos][i].localCurrGrossAmt) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_gross_amt_local_curr", value: JsonData[pos][i].localCurrGrossAmt })
                        }

                        if (difalActive) {
                            if (JsonData[pos][i]["difalOrigen"]) {
                                recordSummary.setValue({ fieldId: "custrecord_lmry_br_difal_alicuota", value: JsonData[pos][i]["difalOrigen"] });
                            }

                            if (JsonData[pos][i]["difalDestination"]) {
                                recordSummary.setValue({ fieldId: "custrecord_lmry_br_difal_alicuota_des", value: JsonData[pos][i]["difalDestination"] });
                            }

                            if (JsonData[pos][i]["difalAmountauto"]) {
                                recordSummary.setValue({ fieldId: "custrecord_lmry_br_difal_amount", value: JsonData[pos][i]["difalAmountauto"] });
                            }
                        } else {
                            if (JsonData[pos][i]["difalTaxRate"]) {
                                recordSummary.setValue({ fieldId: "custrecord_lmry_br_difal_alicuota", value: JsonData[pos][i]["difalTaxRate"] });
                            }

                            if (JsonData[pos][i]["difalAmount"]) {
                                recordSummary.setValue({ fieldId: "custrecord_lmry_br_difal_amount", value: JsonData[pos][i]["difalAmount"] });
                            }
                        }

                        if (JsonData[pos][i]["isApplyReport"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_br_apply_report", value: JsonData[pos][i]["isApplyReport"] });
                        }

                        if (JsonData[pos][i]["isImportTax"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_br_is_import_tax_result", value: JsonData[pos][i]["isImportTax"] });
                        }

                        if (JsonData[pos][i]["baseNoTributada"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_br_base_no_tributada", value: JsonData[pos][i]["baseNoTributada"] });
                        }


                        if (JsonData[pos][i]["baseNoTributadaLocCurr"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_base_no_tributad_loc_cur", value: JsonData[pos][i]["baseNoTributadaLocCurr"] });
                        }

                        if (JsonData[pos][i]["isSubstitutionTax"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_is_substitution_tax_resu", value: JsonData[pos][i]["isSubstitutionTax"] });
                        }

                        if (JsonData[pos][i]["faTaxRate"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_res_fa_tax_rate", value: JsonData[pos][i]["faTaxRate"] });
                        }

                        if (JsonData[pos][i]["faTaxAmount"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_res_fa_tax_amount", value: JsonData[pos][i]["faTaxAmount"] });
                        }

                        if (JsonData[pos][i]["fixedAssetNS"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_res_fixasset_ns", value: JsonData[pos][i]["fixedAssetNS"] })
                        }

                        if (JsonData[pos][i]["fixedAsset"]) {
                            recordSummary.setValue({ fieldId: "custrecord_lmry_res_fixasset", value: JsonData[pos][i]["fixedAsset"] });
                        }


                        var idTR = recordSummary.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        arrayTR.push(parseInt(idTR));

                    } // Fin For arreglo de retenciones
                }

                return arrayTR;

            } catch (error) {
                log.error('[createTaxResult]', error);
                lbryLog.doLog({ title: "[ createTaxResult ]", message: error, relatedScript: "LMRY_BR_LatamTax_Purchase_LBRY_V2.0.js" });
                return [];
            }
        }

        function updateLine(JsonData, recordObj, line, taxCalculationForm) {
            // Si es Brasil y No es Exento, llena la columna "LatamReady - BR Total Taxes" con la sumatoria de los impuestos calculados
            var newAmount_Impuestos = 0;
            if (JsonData[line]) {

                for (var i = 0; i < JsonData[line].length; i++) {
                    var exempt = JsonData[line][i].isExempt;
                    if (exempt == false) {
                        newAmount_Impuestos += round2(parseFloat(JsonData[line][i].retencion));
                    } // Fin if BR y Exempt = false
                }
                recordObj.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_lmry_br_total_impuestos',
                    line: line,
                    value: newAmount_Impuestos
                });
            }

            log.debug('LBRY - newAmount_Impuestos', newAmount_Impuestos);

            var featureMultiPrice = runtime.isFeatureInEffect({ feature: 'multprice' });

            /*************************************************************************************
             * Si es Brasil, actualiza los montos de linea de la transaccion dependiendo del flujo
             *************************************************************************************/
            var totalTaxItem = newAmount_Impuestos;
            totalTaxItem = parseFloat(totalTaxItem);

            if (recordObj.getValue("baserecordtype") != "itemfulfillment") {
                var netamtItem = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: line
                });
                netamtItem = parseFloat(netamtItem);
                var quantityItem = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: line
                });
                quantityItem = parseFloat(quantityItem);
                //if (totalTaxItem > 0) {
                switch (taxCalculationForm) {
                    // Flujo 0: Del Net
                    case '1':
                        // Setea los nuevos valores al item
                        var grossItem = netamtItem + totalTaxItem;
                        recordObj.setSublistValue('item', 'tax1amt', line, totalTaxItem);
                        recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', line, parseFloat(Math.round(parseFloat(netamtItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'custcol_lmry_br_total_impuestos', line, parseFloat(Math.round(parseFloat(totalTaxItem) * 100) / 100));
                        break;
                    // Flujo 1: Del Gross
                    case '2':
                        var grossItem = recordObj.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: line
                        });
                        grossItem = parseFloat(grossItem);
                        var netItem = grossItem - totalTaxItem;
                        var rateItem = parseFloat(netItem) / quantityItem;
                        // Setea los nuevos valores al item
                        if (featureMultiPrice == true || featureMultiPrice == 'T') {
                            recordObj.setSublistValue('item', 'price', line, -1);
                        }
                        recordObj.setSublistValue('item', 'rate', line, parseFloat(Math.round(parseFloat(rateItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'amount', line, parseFloat(Math.round(parseFloat(netItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'tax1amt', line, parseFloat(Math.round(parseFloat(totalTaxItem) * 100) / 100));
                        //recordObj.setSublistValue('item', 'grossamt', line, parseFloat(Math.round(parseFloat(grossItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', line, parseFloat(Math.round(parseFloat(grossItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'custcol_lmry_br_total_impuestos', line, parseFloat(Math.round(parseFloat(totalTaxItem) * 100) / 100));
                        break;
                    // Flujo 2: Del Neto + Impuesto
                    case '3':
                        var netItem = netamtItem + totalTaxItem;
                        var rateItem = parseFloat(netItem) / quantityItem;
                        // Si no tiene retenciones
                        if (featureMultiPrice == true || featureMultiPrice == 'T') {
                            recordObj.setSublistValue('item', 'price', line, -1);
                        }
                        recordObj.setSublistValue('item', 'rate', line, parseFloat(Math.round(parseFloat(rateItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'amount', line, parseFloat(Math.round(parseFloat(netItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'tax1amt', line, 0);
                        recordObj.setSublistValue('item', 'grossamt', line, parseFloat(Math.round(parseFloat(netItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', line, parseFloat(Math.round(parseFloat(netamtItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'custcol_lmry_br_total_impuestos', line, parseFloat(Math.round(parseFloat(totalTaxItem) * 100) / 100));
                        break;
                    // Flujo 3: Del Gross
                    case '4':
                        var grossItem = recordObj.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'grossamt',
                            line: line
                        });
                        grossItem = parseFloat(grossItem);
                        // Setea los nuevos valores al item
                        recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', line, parseFloat(Math.round(parseFloat(grossItem) * 100) / 100));
                        recordObj.setSublistValue('item', 'custcol_lmry_br_total_impuestos', line, parseFloat(Math.round(parseFloat(totalTaxItem) * 100) / 100));
                        break;
                }
            } else {
                var quantity = recordObj.getSublistValue({ sublistId: "item", fieldId: "quantity", line: line }) || 0.00;
                var precUnit = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_prec_unit_so", line: line }) || 0.00;
                var baseAmount = round2(parseFloat(quantity) * parseFloat(precUnit));

                recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', line, round2(baseAmount));
                recordObj.setSublistValue('item', 'custcol_lmry_br_total_impuestos', line, round2(totalTaxItem));
            }
        }


        function round2(num) {
            if (num >= 0) {
                return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-3) / 1e2);
            } else {
                return parseFloat(Math.round(parseFloat(num) * 1e2 - 1e-3) / 1e2);
            }
        }

        function round4(num) {
            if (num >= 0) {
                return parseFloat(Math.round(parseFloat(num) * 1e4 + 1e-3) / 1e4);
            } else {
                return parseFloat(Math.round(parseFloat(num) * 1e4 - 1e-3) / 1e4);
            }
        }

        /********************************************************
         * Concatena los libros contables en caso tenga Multibook
         ********************************************************/
        function concatenarAccountingBooks(recordObj) {
            var auxBookMB = 0;
            var auxExchangeMB = recordObj.getValue({
                fieldId: 'exchangerate'
            });

            var featureMultiBook = runtime.isFeatureInEffect({
                feature: "MULTIBOOK"
            });

            if (featureMultiBook) {
                if (recordObj.getValue("baserecordtype") != "itemfulfillment") {
                    var lineasBook = recordObj.getLineCount({
                        sublistId: 'accountingbookdetail'
                    });
                    if (lineasBook != null & lineasBook != '') {
                        for (var j = 0; j < lineasBook; j++) {
                            var lineaBook = recordObj.getSublistValue({
                                sublistId: 'accountingbookdetail',
                                fieldId: 'accountingbook',
                                line: j
                            });
                            var lineaExchangeRate = recordObj.getSublistValue({
                                sublistId: 'accountingbookdetail',
                                fieldId: 'exchangerate',
                                line: j
                            });
                            auxBookMB = auxBookMB + '|' + lineaBook;
                            auxExchangeMB = auxExchangeMB + '|' + lineaExchangeRate;
                        }
                    }
                } else {
                    var lineBookSearch = search.create({
                        type: "transaction",
                        filters: [
                            ["mainline", "is", "T"], "AND",
                            ["internalid", "anyof", recordObj.id]
                        ],
                        columns: [
                            "accountingTransaction.accountingbook", "accountingTransaction.exchangerate"
                        ]
                    });

                    var results = lineBookSearch.run().getRange(0, 100);
                    if (results) {
                        for (var i = 0; i < results.length; i++) {
                            var lineBook = results[i].getValue({ join: "accountingTransaction", name: "accountingbook" });
                            var lineExchangeRate = results[i].getValue({ join: "accountingTransaction", name: "exchangerate" });
                            auxBookMB = auxBookMB + '|' + lineBook;
                            auxExchangeMB = auxExchangeMB + '|' + lineExchangeRate;
                        }
                    }
                }
            } // Fin Multibook
            return auxBookMB + '&' + auxExchangeMB;
        }

        function getmvaRecords(recordObj) {
            var mvaRecords = {};
            var filters = [
                ["isinactive", "is", "F"]
            ];

            var FEAT_SUBS = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

            if (FEAT_SUBS) {
                var subsidiary = recordObj.getValue("subsidiary");
                filters.push("AND", ["custrecord_lmry_br_mva_subsidiary", "anyof", subsidiary]);
            }

            var mvaSearch = search.create({
                type: "customrecord_lmry_br_mva",
                filters: filters,
                columns: ["internalid", "custrecord_lmry_br_mva_rate",
                    "custrecord_lmry_br_mva_ncm", "custrecord_lmry_br_mva_subtype", "custrecord_lmry_br_mva_taxrate",
                    "custrecord_lmry_br_mva_subtype_substi", "custrecord_lmry_br_mva_taxrate_substi"
                ]
            });

            var results = mvaSearch.run().getRange(0, 1000);
            if (results && results.length) {
                for (var i = 0; i < results.length; i++) {
                    var internalId = results[i].getValue("internalid");
                    var mvaRate = results[i].getValue("custrecord_lmry_br_mva_rate");
                    mvaRate = parseFloat(mvaRate) || 0.00;
                    var mcnCode = results[i].getValue("custrecord_lmry_br_mva_ncm");
                    var taxSubtype = results[i].getValue("custrecord_lmry_br_mva_subtype");
                    var taxRate = results[i].getValue("custrecord_lmry_br_mva_taxrate") || 0.00;
                    taxRate = parseFloat(taxRate);
                    var substiTaxSubtype = results[i].getValue("custrecord_lmry_br_mva_subtype_substi");
                    var substiTaxRate = results[i].getValue("custrecord_lmry_br_mva_taxrate_substi") || 0.00;
                    substiTaxRate = parseFloat(substiTaxRate);

                    mvaRecords[mcnCode] = mvaRecords[mcnCode] || [];
                    mvaRecords[mcnCode].push({
                        mvaId: internalId,
                        mvaRate: mvaRate,
                        mcnCode: mcnCode,
                        taxSubtype: taxSubtype,
                        taxRate: taxRate,
                        substiTaxSubtype: substiTaxSubtype,
                        substiTaxRate: substiTaxRate
                    });
                }
            }

            return mvaRecords;
        }

        function getMVAByValues(mvaRecords, mcnCode, subtype, taxRate, substiSubtype, substiTaxRate) {
            var mvaList = [];
            if (mvaRecords[mcnCode]) {
                var records = mvaRecords[mcnCode];
                for (var i = 0; i < records.length; i++) {
                    var MVA = records[i];
                    var found = true;
                    if (subtype && (Number(MVA["taxSubtype"]) != Number(subtype))) {
                        found = false;
                    }

                    if (taxRate && (round4(MVA["taxRate"]) != round4(taxRate))) {
                        found = false;
                    }

                    if (substiSubtype && (Number(MVA["substiTaxSubtype"]) != Number(substiSubtype))) {
                        found = false;
                    }

                    if (substiTaxRate && (round4(MVA["substiTaxRate"]) != round4(substiTaxRate))) {
                        found = false;
                    }

                    if (found) {
                        mvaList.push(MVA);
                    }
                }
            }
            return mvaList;
        }

        function calculateSubstitutionTaxes(recordObj, taxesToST, stTaxes, taxesNotIncluded, jsonArray, exchangeRate) {
            var numItems = recordObj.getLineCount({ sublistId: "item" });
            for (var i = 0; i < numItems; i++) {
                var item = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
                var itemName = recordObj.getSublistText({ sublistId: "item", fieldId: "item", line: i });
                var lineUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: i }) || "";
                var grossAmt = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'grossamt', line: i });
                grossAmt = parseFloat(grossAmt);

                var fixedAsset = "";
                if (NS_FA_ACTIVE == true || NS_FA_ACTIVE == "T") {
                    var faNSField = recordObj.getSublistField({ sublistId: "item", fieldId: "custcol_far_trn_relatedasset", line: i });

                    if (faNSField) {
                        fixedAsset = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_far_trn_relatedasset", line: i }) || "";
                    }
                } else {
                    fixedAsset = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_br_fixed_assets", line: i }) || "";
                }

                if (taxesToST[i]) {

                    var totalTaxesNotIncluded = 0.00;
                    if (taxesNotIncluded[i]) {
                        for (var tx in taxesNotIncluded[i]) {
                            totalTaxesNotIncluded = totalTaxesNotIncluded + (taxesNotIncluded[i][tx]["amount"] || 0.00)
                        }
                    }

                    for (var mvaId in taxesToST[i]) {
                        for (var t = 0; t < taxesToST[i][mvaId].length; t++) {
                            var tax = taxesToST[i][mvaId][t];
                            var taxRate = tax["taxRate"];
                            taxRate = parseFloat(taxRate);
                            var mvaRate = tax["mvaRate"];
                            var baseSt = (grossAmt + totalTaxesNotIncluded) * (1 + mvaRate);
                            baseSt = round2(baseSt);
                            if (baseSt) {
                                if (stTaxes[i] && stTaxes[i][mvaId]) {
                                    for (var s = 0; s < stTaxes[i][mvaId].length; s++) {
                                        var stTax = stTaxes[i][mvaId][s];
                                        var stTaxRate = stTax["taxRate"];
                                        var faTaxRate = stTax["faTaxRate"];

                                        var stTaxAmount = baseSt * stTaxRate - grossAmt * taxRate;

                                        var localCurrBaseAmt = baseSt;
                                        var localCurrAmt = stTaxAmount;
                                        var localCurrGrossAmt = grossAmt;

                                        if (exchangeRate != 1) {
                                            localCurrBaseAmt = round2(baseSt) * exchangeRate;
                                            localCurrAmt = round2(stTaxAmount) * exchangeRate;
                                            localCurrGrossAmt = round2(grossAmt) * exchangeRate;
                                        }
                                        var faTaxAmount = 0.00;
                                        if (faTaxRate && fixedAsset) {
                                            faTaxAmount = parseFloat(grossAmt) * faTaxRate;
                                            if (exchangeRate != 1) {
                                                faTaxAmount = round2(faTaxAmount) * exchangeRate;
                                            }
                                        }

                                        if (stTaxAmount && stTaxAmount > 0) {
                                            jsonArray[i].push({
                                                subType: stTax["subType"],
                                                subTypeID: stTax["subTypeId"],
                                                lineUniqueKey: lineUniqueKey,
                                                baseAmount: baseSt,
                                                retencion: round4(stTaxAmount),
                                                idCCNT: stTax["taxRecordId"],
                                                taxRate: stTaxRate,
                                                caso: stTax["case"],
                                                items: item,
                                                itemsName: itemName,
                                                posicionItem: i,
                                                receita: stTax["receita"],
                                                taxSituation: stTax["taxSituation"],
                                                natureRevenue: stTax["natureRevenue"],
                                                regimen: stTax["regimen"],
                                                localCurrBaseAmt: localCurrBaseAmt,
                                                localCurrAmt: localCurrAmt,
                                                localCurrGrossAmt: localCurrGrossAmt,
                                                isSubstitutionTax: true,
                                                isTaxNotIncluded: true,
                                                taxItem: stTax["taxItem"],
                                                taxCode: stTax["taxCode"],
                                                faTaxRate: faTaxRate,
                                                faTaxAmount: faTaxAmount,
                                                fixedAsset: (faTaxRate && !NS_FA_ACTIVE) ? fixedAsset : "",
                                                fixedAssetNS: (faTaxRate && NS_FA_ACTIVE) ? fixedAsset : ""
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        function addTaxItems(recordObj, taxResults, departmentSetup, classSetup, locationSetup) {

            deleteTaxLines(recordObj);

            var department = recordObj.getValue("department") || "";
            var class_ = recordObj.getValue("class") || "";
            var location = recordObj.getValue("location") || "";

            var taxItems = {}
            for (var pos in taxResults) {
                for (var i = 0; i < taxResults[pos].length; i++) {
                    var taxResult = taxResults[pos][i];
                    var subTypeId = taxResult["subTypeID"];
                    var subType = taxResult["subType"];
                    var taxItem = taxResult["taxItem"];
                    var taxAmount = taxResult["retencion"];
                    var taxCode = taxResult["taxCode"];
                    var isTaxNotIncluded = taxResult["isTaxNotIncluded"];

                    if (isTaxNotIncluded && taxItem) {
                        var key = subTypeId + "-" + taxItem;
                        if (!taxItems[key]) {
                            taxItems[key] = {
                                subTypeId: subTypeId,
                                subType: subType,
                                item: taxItem,
                                taxCode: taxCode,
                                amount: 0.00
                            }
                        }

                        taxItems[key]["amount"] = taxItems[key]["amount"] + parseFloat(taxAmount);

                    }
                }
            }

            log.debug("taxItems", JSON.stringify(taxItems));

            for (var k in taxItems) {
                var lineNum = recordObj.getLineCount('item');
                var tax = taxItems[k];
                var subType = tax["subType"];
                var item = tax["item"];
                var amount = tax["amount"];
                amount = round2(amount);
                var taxCode = tax["taxCode"] || "";

                if (amount > 0) {
                    recordObj.insertLine({ sublistId: 'item', line: lineNum });
                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'item', line: lineNum, value: item });
                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNum, value: 1 });
                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: amount });
                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'taxcode', line: lineNum, value: taxCode });
                    var description = subType + ' (LatamTax) ';
                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'description', line: lineNum, value: description });
                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_ar_item_tributo', line: lineNum, value: true });
                    recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_apply_wht_tax', line: lineNum, value: false });
                    if (enab_dep == "T" || enab_dep == true) {
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'department', line: lineNum, value: department });
                        if ((DEPTMANDATORY == "T" || DEPTMANDATORY == true) && !department) {
                            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'department', line: lineNum, value: departmentSetup });
                        }
                    }

                    if (enab_clas == "T" || enab_clas == true) {
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'class', line: lineNum, value: class_ });
                        if ((CLASSMANDATORY == "T" || CLASSMANDATORY == true) && !class_) {
                            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'class', line: lineNum, value: classSetup });
                        }
                    }
                    var locationfield = recordObj.getSublistField({ sublistId: 'item', fieldId: 'location', line: lineNum });
                    if ((enab_loc == "T" || enab_loc == true) && locationfield) {
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'location', line: lineNum, value: location });
                        if ((LOCMANDATORY == "T" || LOCMANDATORY == true) && !location) {
                            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'location', line: lineNum, value: locationSetup });
                        }
                    }
                }
            }
        }

        function deleteTaxLines(recordObj) {
            var ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });
            while (true) {
                var idxRemove = -1;
                var currentNumberLine = recordObj.getLineCount({
                    sublistId: 'item'
                });
                for (var i = currentNumberLine; i >= 0; i--) {
                    var isItemTax = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_lmry_ar_item_tributo',
                        line: i
                    });
                    if (isItemTax || isItemTax == 'T') {
                        idxRemove = i;
                        break;
                    }
                }

                if (idxRemove > -1) {
                    recordObj.removeLine({
                        sublistId: 'item',
                        line: idxRemove
                    });
                    if (ST_FEATURE == "T" || ST_FEATURE == true) {
                        recordObj.removeLine({
                            sublistId: 'taxdetails',
                            line: idxRemove
                        });
                    }
                } else {
                    break;
                }
            }
        }

        /*******************************************************************************************
        * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
        *******************************************************************************************/
        function getExchangeRate(recordObj, currencySetup) {
            var featureSubs = runtime.isFeatureInEffect({
                feature: "SUBSIDIARIES"
            });

            var featureMB = runtime.isFeatureInEffect({
                feature: "MULTIBOOK"
            });
            var exchangeRate = 1;
            var currency = recordObj.getValue({
                fieldId: 'currency'
            });

            if (featureSubs && featureMB) { // OneWorld y Multibook
                var subsidiary = recordObj.getValue("subsidiary");

                var currencySubs = search.lookupFields({
                    type: 'subsidiary',
                    id: subsidiary,
                    columns: ['currency']
                });
                currencySubs = currencySubs.currency[0].value;

                if (currencySubs != currencySetup && currencySetup) {

                    if (recordObj.getValue("baserecordtype") != "itemfulfillment") {
                        var lineasBook = recordObj.getLineCount({
                            sublistId: 'accountingbookdetail'
                        });
                        if (lineasBook != null && lineasBook != '') {
                            for (var i = 0; i < lineasBook; i++) {
                                var lineaCurrencyMB = recordObj.getSublistValue({
                                    sublistId: 'accountingbookdetail',
                                    fieldId: 'currency',
                                    line: i
                                });
                                if (lineaCurrencyMB == currencySetup) {
                                    exchangeRate = recordObj.getSublistValue({
                                        sublistId: 'accountingbookdetail',
                                        fieldId: 'exchangerate',
                                        line: i
                                    });
                                    break;
                                }
                            }
                        }
                    } else {
                        var lineBookSearch = search.create({
                            type: "transaction",
                            filters: [
                                ["mainline", "is", "T"], "AND",
                                ["internalid", "is", recordObj.id]
                            ],
                            columns: [
                                "accountingTransaction.accountingbook", "accountingTransaction.basecurrency",
                                "accountingTransaction.exchangerate"
                            ],
                            settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
                        });

                        var results = lineBookSearch.run().getRange(0, 100);
                        if (results) {
                            for (var i = 0; i < results.length; i++) {
                                var lineCurrencyBook = results[i].getValue({ join: "accountingTransaction", name: "basecurrency" });
                                if (Number(lineCurrencyBook) == Number(currencySetup)) {
                                    exchangeRate = results[i].getValue({ join: "accountingTransaction", name: "exchangerate" });
                                    break;
                                }
                            }
                        }
                    }
                } else { // La moneda de la subsidiaria es igual a la moneda del setup
                    exchangeRate = recordObj.getValue({
                        fieldId: 'exchangerate'
                    });
                }
            } else { // No es OneWorld o no tiene Multibook
                exchangeRate = recordObj.getValue({
                    fieldId: 'exchangerate'
                });
            }
            exchangeRate = parseFloat(exchangeRate);
            return exchangeRate;
        }

        /**********************************************************
        * Busqueda en el record: LatamReady - Setup Tax Subsidiary
        **********************************************************/
        function getSetupTaxSubsidiary(subsidiaryId) {
            var setupTax = {}
            var featureSubs = runtime.isFeatureInEffect({
                feature: "SUBSIDIARIES"
            });
            var filtros = new Array();
            filtros[0] = search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: ['F']
            });
            if (featureSubs) {
                filtros[1] = search.createFilter({
                    name: 'custrecord_lmry_setuptax_subsidiary',
                    operator: 'is',
                    values: [subsidiaryId]
                });
            }
            var searchSetupSubsidiary = search.create({
                type: "customrecord_lmry_setup_tax_subsidiary",
                filters: filtros,
                columns: ['custrecord_lmry_setuptax_subsidiary', 'custrecord_lmry_setuptax_type_rounding', 'custrecord_lmry_setuptax_currency',
                    'custrecord_lmry_setuptax_br_ap_flow', 'custrecord_lmry_setuptax_department', 'custrecord_lmry_setuptax_class',
                    'custrecord_lmry_setuptax_location', 'custrecord_lmry_setuptax_br_province', 'custrecord_lmry_setuptax_br_difal_acct',
                    'custrecord_lmry_setuptax_form_journal', 'custrecord_lmry_setuptax_br_difal_obs', 'custrecord_lmry_setuptax_br_minimum_purc',
                    'custrecord_lmry_setuptax_form_credit', 'custrecord_lmry_setuptax_form_bill', 'custrecord_lmry_setuptax_depclassloc']
            });
            var resultSearchSub = searchSetupSubsidiary.run().getRange({
                start: 0,
                end: 1000
            });

            if (resultSearchSub.length != null && resultSearchSub.length != '') {
                if (resultSearchSub.length > 0) {
                    setupTax["rounding"] = resultSearchSub[0].getValue({
                        name: 'custrecord_lmry_setuptax_type_rounding'
                    });
                    setupTax["currency"] = resultSearchSub[0].getValue({
                        name: 'custrecord_lmry_setuptax_currency'
                    });
                    setupTax["taxFlow"] = resultSearchSub[0].getValue({
                        name: 'custrecord_lmry_setuptax_br_ap_flow'
                    }) || 1;

                    setupTax["segmentacion"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_depclassloc");

                    setupTax["department"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_department");
                    setupTax["class"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_class");
                    setupTax["location"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_location");
                    setupTax["province"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_br_province");
                    setupTax["difalAccount"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_br_difal_acct");
                    setupTax["formJournal"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_form_journal");
                    setupTax["fiscalobs"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_br_difal_obs");

                    //RETENCIONES LATAM
                    setupTax["minimumTax"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_br_minimum_purc") || 0;
                    setupTax["formCredit"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_form_credit");
                    setupTax["formBill"] = resultSearchSub[0].getValue("custrecord_lmry_setuptax_form_bill");
                }
            }
            return setupTax;
        }

        function deleteTaxResults(transactionId) {
            if (transactionId) {
                var searchTaxResults = search.create({
                    type: 'customrecord_lmry_br_transaction',
                    filters: [
                        ['custrecord_lmry_br_transaction', 'anyof', transactionId], 'AND',
                        ['custrecord_lmry_tax_type', 'anyof', "4"], "AND",
                        ["custrecord_lmry_total_item", "doesnotstartwith", "Tax Calculator"]
                    ],
                    columns: ['internalid']
                });

                var results = searchTaxResults.run().getRange(0, 1000);
                if (results != null && results != '') {
                    for (var i = 0; i < results.length; i++) {
                        var internalid = results[i].getValue('internalid');
                        if (internalid) {
                            record.delete({
                                type: 'customrecord_lmry_br_transaction',
                                id: internalid
                            });
                        }
                    }
                }
            }
        }

        function getDifalinSubtype() {
            var listaux = [];
            var searchSubtype = search.create({
                type: 'customrecord_lmry_ar_wht_type',
                filters: [
                    ['custrecord_lmry_difal_applied', 'is', 'T'], 'AND',
                    ['custrecord_lmry_withholding_country', 'is', '30'], 'AND',
                    ['isinactive', 'is', 'F']
                ],
                columns: ['internalid']
            });
            var searchSubtype = searchSubtype.run().getRange(0, 1000);
            if (searchSubtype != null && searchSubtype != '') {
                for (var i = 0; i < searchSubtype.length; i++) {
                    var internalid = searchSubtype[i].getValue('internalid');
                    listaux.push(internalid);
                }
            }
            return listaux;
        }

        function getProvinceRate() {
            var listaux = {};
            var searchSubtype = search.create({
                type: 'customrecord_lmry_br_province_difal_rate',
                filters: [
                    ['isinactive', 'is', 'F']
                ],
                columns: ['custrecord_lmry_br_difal_province', 'custrecord_lmry_br_difal_percentage']
            });
            var searchSubtype = searchSubtype.run().getRange(0, 1000);
            if (searchSubtype != null && searchSubtype != '') {
                for (var i = 0; i < searchSubtype.length; i++) {
                    var province = searchSubtype[i].getValue('custrecord_lmry_br_difal_province');
                    var percentage = searchSubtype[i].getValue('custrecord_lmry_br_difal_percentage');
                    listaux[province] = parseFloat(percentage);
                }
            }
            return listaux;
        }

        function getBRTransFields(idtran) {
            var listaux = {};
            var searchBRtrans = search.create({
                type: 'customrecord_lmry_br_transaction_fields',
                filters: [
                    ['custrecord_lmry_br_related_transaction', 'is', idtran], 'AND',
                    ['isinactive', 'is', 'F']
                ],
                columns: ['custrecord_lmry_br_province_transaction', 'custrecord_lmry_br_fiscal_observations']
            });
            // Compra Difal = 2
            var searchBRtrans = searchBRtrans.run().getRange(0, 1);
            if (searchBRtrans != null && searchBRtrans != '') {
                var province = searchBRtrans[0].getValue('custrecord_lmry_br_province_transaction');
                var fiscalobs = searchBRtrans[0].getValue('custrecord_lmry_br_fiscal_observations');
                listaux['province'] = province;
                listaux['fiscalobs'] = fiscalobs;
            }
            return listaux;
        }

        function createJournalDifal(origenAmount, destinoAmount, setupTax, TranObj, subtype, position) {

            var journalObj = record.create({ type: 'journalentry' });

            if (setupTax['formJournal']) {
                journalObj.setValue('customform', setupTax['formJournal']);
            }
            origenAmount = Math.round(origenAmount * 100) / 100;
            destinoAmount = Math.round(destinoAmount * 100) / 100;

            journalObj.setValue('subsidiary', TranObj.getValue('subsidiary'));
            journalObj.setValue('trandate', TranObj.getValue('trandate'));
            journalObj.setValue('custbody_lmry_reference_transaction', TranObj.id);
            journalObj.setValue('custbody_lmry_reference_transaction_id', TranObj.id);
            journalObj.setValue('custbody_lmry_type_concept', 23);

            journalObj.setValue('currency', TranObj.getValue('currency'));
            journalObj.setValue('exchangerate', TranObj.getValue('exchangerate'));
            journalObj.setValue('memo', 'DIFAL Transaction: ' + TranObj.id);

            //Origen
            journalObj.setSublistValue('line', 'account', 0, TranObj.getValue('account'));
            journalObj.setSublistValue('line', 'debit', 0, origenAmount);
            journalObj.setSublistValue('line', 'custcol_lmry_br_tax', 0, subtype);
            if (enab_dep && TranObj.getSublistValue('item', 'department', position)) {
                journalObj.setSublistValue('line', 'department', 0, TranObj.getSublistValue('item', 'department', position));
            }
            if (enab_clas && TranObj.getSublistValue('item', 'class', position)) {
                journalObj.setSublistValue('line', 'class', 0, TranObj.getSublistValue('item', 'class', position));
            }
            if (enab_loc && TranObj.getSublistValue('item', 'location', position)) {
                journalObj.setSublistValue('line', 'location', 0, TranObj.getSublistValue('item', 'location', position));
            }
            if (TranObj.getSublistValue('item', 'custcol_lmry_adjust_origin', position)) {
                journalObj.setSublistValue('line', 'custcol_lmry_adjust_origin', 0, TranObj.getSublistValue('item', 'custcol_lmry_adjust_origin', position));
            }
            journalObj.setSublistValue('line', 'custcol_lmry_item_posicion', 0, TranObj.getSublistValue('item', 'lineuniquekey', position));

            //Destination
            journalObj.setSublistValue('line', 'account', 1, TranObj.getValue('account'));
            journalObj.setSublistValue('line', 'credit', 1, destinoAmount);
            journalObj.setSublistValue('line', 'custcol_lmry_br_tax', 1, subtype);
            if (enab_dep && TranObj.getSublistValue('item', 'department', position)) {
                journalObj.setSublistValue('line', 'department', 1, TranObj.getSublistValue('item', 'department', position));
            }
            if (enab_clas && TranObj.getSublistValue('item', 'class', position)) {
                journalObj.setSublistValue('line', 'class', 1, TranObj.getSublistValue('item', 'class', position));
            }
            if (enab_loc && TranObj.getSublistValue('item', 'location', position)) {
                journalObj.setSublistValue('line', 'location', 1, TranObj.getSublistValue('item', 'location', position));
            }
            if (TranObj.getSublistValue('item', 'custcol_lmry_adjust_destiny', position)) {
                journalObj.setSublistValue('line', 'custcol_lmry_adjust_destiny', 1, TranObj.getSublistValue('item', 'custcol_lmry_adjust_destiny', position));
            }
            journalObj.setSublistValue('line', 'custcol_lmry_item_posicion', 1, TranObj.getSublistValue('item', 'lineuniquekey', position));

            //DIFAL
            var difalAmt = Math.abs(origenAmount - destinoAmount);
            difalAmt = Math.round(difalAmt * 100) / 100;

            if (difalAmt > 0) {
                journalObj.setSublistValue('line', 'account', 2, setupTax['difalAccount']);
                if (origenAmount > destinoAmount) {
                    journalObj.setSublistValue('line', 'credit', 2, difalAmt);
                } else {
                    journalObj.setSublistValue('line', 'debit', 2, difalAmt);
                }
                if (enab_dep && TranObj.getSublistValue('item', 'department', position)) {
                    journalObj.setSublistValue('line', 'department', 2, TranObj.getSublistValue('item', 'department', position));
                }
                if (enab_clas && TranObj.getSublistValue('item', 'class', position)) {
                    journalObj.setSublistValue('line', 'class', 2, TranObj.getSublistValue('item', 'class', position));
                }
                if (enab_loc && TranObj.getSublistValue('item', 'location', position)) {
                    journalObj.setSublistValue('line', 'location', 2, TranObj.getSublistValue('item', 'location', position));
                }
            }
            if (featureAprove == 'T' || featureAprove == true) {
                journalObj.setValue('approvalstatus', 2);
            }

            journalObj.save({ disableTriggers: true });

            return true;
        }

        function fixedAssetBundleActive(subsidiary, licenses) {
            subsidiary = subsidiary || "";
            var nsAssetsActive = false;
            if (!licenses) {
                licenses = libraryMail.getLicenses(subsidiary) || [];
            }

            if (!libraryMail.getAuthorization(663, licenses)) {
                var bundleId = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_fixed_asset_bundled_id" }) || "";
                if (bundleId) {
                    nsAssetsActive = suiteAppInfo.isBundleInstalled({
                        bundleId: bundleId
                    });
                }
            }
            return (nsAssetsActive == true || nsAssetsActive == "T")
        }

        function createJournalCreditCard(creditCardObj, jsonSetupTaxSubsidiary){

          //VARIABLES SETUP TAX SUBSIDIARY
          var apTaxFlow = jsonSetupTaxSubsidiary['taxFlow'];
          var clasificacionSetup = jsonSetupTaxSubsidiary['segmentacion'];
          var depSetup = jsonSetupTaxSubsidiary['department'];
          var classSetup = jsonSetupTaxSubsidiary['class'];
          var locSetup = jsonSetupTaxSubsidiary['location'];
          var formJournal = jsonSetupTaxSubsidiary['formJournal'];

          //CREACION JOURNAL: CAMPOS DE CABECERA
          var journalObj = record.create({ type: 'journalentry' });

          if (formJournal) {
              journalObj.setValue('customform', formJournal);
          }

          if(subsiOW){
            journalObj.setValue('subsidiary', creditCardObj.getValue('subsidiary'));
          }

          journalObj.setValue('trandate', creditCardObj.getValue('trandate'));
          journalObj.setValue('custbody_lmry_reference_transaction', creditCardObj.id);
          journalObj.setValue('custbody_lmry_reference_transaction_id', creditCardObj.id);

          journalObj.setValue('currency', creditCardObj.getValue('currency'));
          journalObj.setValue('exchangerate', creditCardObj.getValue('exchangerate'));
          journalObj.setValue('memo', 'Credit Card Transaction: ' + creditCardObj.id);

          if(featureAprove == 'T' || featureAprove == true) {
              journalObj.setValue('approvalstatus', 2);
          }

          //BUSQUEDA DE TAX RESULTS DE CALCULO DE IMPUESTOS
          var columnsTaxResult = [];
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_br_type" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_br_type_id" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_br_total" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_br_positem" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_item" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_ccl" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_ntax" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_br_is_import_tax_result" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_ccl_br_nivel_contabiliz", join: "custrecord_lmry_ccl" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_nt_br_nivel_contabiliz", join: "custrecord_lmry_ntax" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_is_substitution_tax_resu" }));
          columnsTaxResult.push(search.createColumn({ name: "custrecord_lmry_is_tax_not_included", join: "custrecord_lmry_br_type_id" }));

          var searchTaxResult = search.create({type: 'customrecord_lmry_br_transaction', filters: [{name: 'custrecord_lmry_br_transaction', operator: 'anyof', values: creditCardObj.id}, {name: 'custrecord_lmry_tax_type', operator: 'is', values: '4'}],
          columns: columnsTaxResult});

          searchTaxResult = searchTaxResult.run().getRange({start: 0, end: 1000});

          var contador = 0;

          if(searchTaxResult && searchTaxResult.length){
            for(var i = 0; i < searchTaxResult.length; i++){

              var subtype = searchTaxResult[i].getValue('custrecord_lmry_br_type');
              var subtypeId = searchTaxResult[i].getValue('custrecord_lmry_br_type_id');
              var amount = searchTaxResult[i].getValue('custrecord_lmry_br_total');

              amount = round2(amount);

              if (parseFloat(amount) <= 0) {
                continue;
              }

              var item = searchTaxResult[i].getValue('custrecord_lmry_item');
              var position = searchTaxResult[i].getValue("custrecord_lmry_br_positem");
              var ccl = searchTaxResult[i].getValue('custrecord_lmry_ccl');
              var ntax = searchTaxResult[i].getValue('custrecord_lmry_ntax');
              var isImportTax = searchTaxResult[i].getValue("custrecord_lmry_br_is_import_tax_result");
              var isTaxSubstitution = searchTaxResult[i].getValue("custrecord_lmry_is_substitution_tax_resu");
              var isTaxNotIncluded = searchTaxResult[i].getValue({name: "custrecord_lmry_is_tax_not_included", join: "custrecord_lmry_br_type_id"});

              if(!ccl && !ntax){
                continue;
              }

              if (Number(apTaxFlow) == 4) {
                if ((isTaxSubstitution == "T" || isTaxSubstitution == true) || (isTaxNotIncluded == "T" || isTaxNotIncluded == true)) {
                  continue;
                }
              }

              var importTaxLevel = (ccl) ? searchTaxResult[i].getValue({name: "custrecord_lmry_ccl_br_nivel_contabiliz", join: "custrecord_lmry_ccl"}) : searchTaxResult[i].getValue({name: "custrecord_lmry_ccl_br_nivel_contabiliz", join: "custrecord_lmry_ntax"});

              if ((isImportTax == "T" || isImportTax == true) && Number(importTaxLevel) != 1) {
                continue;
              }

              //var custFields = (ccl) ? ['custrecord_lmry_br_ccl_account2', 'custrecord_lmry_br_ccl_account1', 'custrecord_lmry_ccl_gl_impact', 'custrecord_lmry_ccl_config_segment'] : ['custrecord_lmry_ntax_credit_account', 'custrecord_lmry_ntax_debit_account', 'custrecord_lmry_ntax_gl_impact', 'custrecord_lmry_ntax_config_segment'];
              var typeRecord = (ccl) ? "customrecord_lmry_ar_contrib_class" : "customrecord_lmry_national_taxes";
              var idRecord = ccl || ntax;

              if(ccl){

                var searchCustFields = search.lookupFields({type: typeRecord, id: idRecord, columns: ['custrecord_lmry_br_ccl_account2', 'custrecord_lmry_br_ccl_account1', 'custrecord_lmry_ccl_gl_impact', 'custrecord_lmry_ccl_config_segment']});

                var debitAcc = searchCustFields['custrecord_lmry_br_ccl_account1'].length ? searchCustFields['custrecord_lmry_br_ccl_account1'][0].value : '';
                var creditAcc = searchCustFields['custrecord_lmry_br_ccl_account2'].length ? searchCustFields['custrecord_lmry_br_ccl_account2'][0].value : '';
                var glimpact = searchCustFields['custrecord_lmry_ccl_gl_impact'];

              }else{

                var searchCustFields = search.lookupFields({type: typeRecord, id: idRecord, columns: ['custrecord_lmry_ntax_credit_account', 'custrecord_lmry_ntax_debit_account', 'custrecord_lmry_ntax_gl_impact', 'custrecord_lmry_ntax_config_segment']});

                var debitAcc = searchCustFields['custrecord_lmry_ntax_debit_account'].length ? searchCustFields['custrecord_lmry_ntax_debit_account'][0].value : '';
                var creditAcc = searchCustFields['custrecord_lmry_ntax_credit_account'].length ? searchCustFields['custrecord_lmry_ntax_credit_account'][0].value : '';
                var glimpact = searchCustFields['custrecord_lmry_ntax_gl_impact'];

              }

              var labelmemo = (ccl) ? 'Contributory Class' : 'National Taxes';

              if ((glimpact == false || glimpact == 'F') || !debitAcc || !creditAcc) {
                continue;
              }

              if(position == null || position == ''){
                continue;
              }

              var department = creditCardObj.getSublistValue({sublistId: 'item', fieldId: 'department', line: position}) || creditCardObj.getValue("department") || "";
              var class_ = creditCardObj.getSublistValue({sublistId: 'item', fieldId: 'class', line: position}) || creditCardObj.getValue("class") || "";
              var location = creditCardObj.getSublistValue({sublistId: 'item', fieldId: 'location', line: position}) || creditCardObj.getValue("location") || "";

              if(clasificacionSetup){
                var dep1 = elegirSegmentacion(DEPTMANDATORY, department, creditCardObj.getValue("department"), depSetup, creditCardObj.getValue("department"));
                var cla1 = elegirSegmentacion(CLASSMANDATORY, class_, creditCardObj.getValue("class"), classSetup, creditCardObj.getValue("class"));
                var loc1 = elegirSegmentacion(LOCMANDATORY, location, creditCardObj.getValue("location"), locSetup, creditCardObj.getValue("location"));
              }else{
                var dep1 = elegirSegmentacion(DEPTMANDATORY, creditCardObj.getValue("department"), department, depSetup, '');
                var cla1 = elegirSegmentacion(CLASSMANDATORY, creditCardObj.getValue("class"), class_, classSetup, '');
                var loc1 = elegirSegmentacion(LOCMANDATORY, creditCardObj.getValue("location"), location, locSetup, '');

              }

              var flagDebit = true;
              for(var j = 0; j < 2; j++){

                var debitOrCredit = (flagDebit) ? 'debit' : 'credit';
                var accountJournal = (flagDebit) ? debitAcc : creditAcc;
                flagDebit = false;

                journalObj.setSublistValue('line', 'account', contador, accountJournal);
                journalObj.setSublistValue('line', debitOrCredit, contador, amount);
                journalObj.setSublistValue('line', 'custcol_lmry_br_tax', contador, subtypeId);
                journalObj.setSublistValue('line', 'memo', contador, subtype + ' (LatamTax - ' + labelmemo + ')');

                journalObj.setSublistValue('line', 'custcol_lmry_item_posicion', contador, creditCardObj.getSublistValue({sublistId: 'item', fieldId: 'lineuniquekey', line: position}));

                if(enab_dep && dep1){
                  journalObj.setSublistValue('line', 'department', contador, dep1);
                }

                if(enab_clas && cla1){
                  journalObj.setSublistValue('line', 'class', contador, cla1);
                }

                if(enab_loc && loc1){
                  journalObj.setSublistValue('line', 'location', contador, loc1);
                }

                contador++;

              }//FIN LINEAS CREDIT Y DEBIT JOURNAL


            }//FIN FOR
          }//FIN IF


          if(contador > 0){
            //log.debug('journalObj', journalObj);
            var idJournal = journalObj.save({ignoreMandatoryFields: true, disableTriggers: true});

            log.debug('idJournalCreditCard', idJournal);

          }

        }


        /***********************************************************************************
         * Funcion que selecciona la segmentación de las líneas en el GL Impact dependiendo
         * de la configuración en el récord "LatamReady - Setup Tax Subsidiary"
         * Parámetros :
         *      pref : segmentacion obligatoria en Preferencias Generales
         *      valor1 / valor2 : Segmentacion de la transaccion o CC/NT segun configuracion
         *      valorSetup : segmentación del Setup Tax Subsidiary
         *      valorDefecto : segmentación de la transacción
         ***********************************************************************************/
        function elegirSegmentacion(pref, valor1, valor2, valorSetup, valorDefecto) {

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
            return '';
          } catch (err) {
            library.sendemail(' [ elegirSegmentacion ] ' + err, LMRY_script);
          }
        }

        function round2(num) {
          var e = (num >= 0) ? 1e-3 : -1e-3;
          return parseFloat(Math.round(parseFloat(num) * 1e2 + e) / 1e2);
        }


        return {
            getTaxPurchase: getTaxPurchase,
            createTaxResult: createTaxResult,
            updateLine: updateLine,
            cleanLinesforCopy: cleanLinesforCopy,
            addTaxItems: addTaxItems,
            getSetupTaxSubsidiary: getSetupTaxSubsidiary,
            deleteTaxResults: deleteTaxResults,
            createJournalCreditCard: createJournalCreditCard
        };

    });
