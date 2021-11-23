/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_ST_LatamTax_Purchase_Schd_LBRY_V2.0.js		||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 05 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/log', 'N/record', 'N/search', 'N/runtime'],
    function (log, record, search, runtime) {

        var LMRY_script = 'LatamReady - BR ST LatamTax Purchase LBRY';
        var arreglo_SumaBaseBR = new Array();
        var arreglo_IndiceBaseBR = new Array();
        var sumaBaseBR = {};
        var blnTaxCalculate = false;
        var totalItemTaxes = {};
        var applyWHT = false;
        var jsonArray = [];


        function getTaxPurchaseLine(transactionObj, setupTaxSubsi, exchangeRate/*, idTransaction, typeTransaction*/) {
            try {
                jsonArray = [];
                var cantidad = 0;

                var filtroTransactionType;
                switch (transactionObj.type) {
                    case 'purchaseorder':
                        filtroTransactionType = 6;
                        break;
                    case 'vendorbill':
                        filtroTransactionType = 4;
                        break;
                    case 'vendorcredit':
                        filtroTransactionType = 7;
                        break;
                    default:
                        return true;
                }

                applyWHT = transactionObj.applyWht;

                var documentType = transactionObj.document;

                var province = transactionObj.province;

                var city = transactionObj.city;

                var district = transactionObj.district;

                var entity = search.lookupFields({
                    type: transactionObj.type,
                    id: transactionObj.internalid,
                    columns: ['entity']
                }).entity[0].value;

                var featureSubs = runtime.isFeatureInEffect({
                    feature: "SUBSIDIARIES"
                });

                var fecha = transactionObj.trandate;

                var subsidiary = 1;
                if (featureSubs) {
                    subsidiary = parseInt(transactionObj.subsidiary);
                }

                var retencion = 0;
                var baseAmount = 0;
                var compareAmount = 0;

                /**********************************************************
                 * Datos en el record: LatamReady - Setup Tax Subsidiary
                 **********************************************************/


                var rounding = '';
                var currencySetup = '';
                var taxCalculationForm = 1;

                if (setupTaxSubsi.rounding) {
                    rounding = setupTaxSubsi.rounding;
                }
                if (setupTaxSubsi.currency) {
                    currencySetup = setupTaxSubsi.currency;
                }
                if (setupTaxSubsi.flow) {
                    taxCalculationForm = setupTaxSubsi.flow;
                }


                var mvaRecords = {}, taxesToST = {}, stTaxes = {}, taxesNotIncluded = {};
                if (Number(taxCalculationForm) == 4) {
                    mvaRecords = getmvaRecords(subsidiary);
                    log.error("mvaRecords", JSON.stringify(mvaRecords));
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
                    }, 'internalid', 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_amount', 'custrecord_lmry_sub_type',
                        'custrecord_lmry_ccl_minamount', 'custrecord_lmry_br_ccl_account1', 'custrecord_lmry_br_ccl_account2',
                        'custrecord_lmry_ccl_gl_impact', 'custrecord_lmry_ccl_addratio',
                        'custrecord_lmry_ccl_description', 'custrecord_lmry_ccl_maxamount',
                        'custrecord_lmry_ccl_not_taxable_minimum', 'custrecord_lmry_ccl_base_amount', 'custrecord_lmry_ccl_set_baseretention',
                        'custrecord_lmry_br_ccl_rate_suma', 'custrecord_lmry_br_receita', 'custrecord_lmry_ar_ccl_isexempt',
                        'custrecord_lmry_br_taxsituation', 'custrecord_lmry_br_nature_revenue', 'custrecord_lmry_br_ccl_regimen_catalog',
                        'custrecord_lmry_sub_type.custrecord_lmry_tax_by_location', 'custrecord_lmry_ccl_difal',
                        'custrecord_lmry_sub_type.custrecord_lmry_br_is_import_tax', 'custrecord_lmry_ccl_br_apply_report',
                        'custrecord_lmry_ccl_is_reduction', 'custrecord_lmry_ccl_reduction_ratio',
                        'custrecord_lmry_sub_type.custrecord_lmry_is_tax_not_included', 'custrecord_lmry_ccl_is_substitution',
                        'custrecord_lmry_ar_ccl_taxitem', 'custrecord_lmry_ar_ccl_taxcode'
                    ],
                    filters: filtrosCC
                });
                var searchResultCC = searchCC.run().getRange({
                    start: 0,
                    end: 1000
                });
                log.error('LBRY - searchResultCC', searchResultCC.length);
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

                        // Si es Suite GL y debe tomar las Cuentas de la CC y estas están vacias, continua con la siguiente iteracion
                        if (glimpact) {
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

                        if (isImportTax == "T" || isImportTax == true) {

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

                            var idItem = transactionObj.itemValue;

                            var idItemName = transactionObj.itemName;

                            //Line Unique Key
                            var lineUniqueKey = transactionObj.lineuniquekey;

                            var flagItem = false;

                            // Rule
                            var ruleItem = transactionObj.rule;
                            // Regimen
                            var regimenItem = transactionObj.regimen;
                            var mcnCode = transactionObj.mcnCode;

                            // Tax Situation
                            var taxSituationItem = 0;
                            switch (subtype_id) {
                                case '10': // PIS
                                    taxSituationItem = transactionObj.cstpis;
                                    break;
                                case '11': // COFINS
                                    taxSituationItem = transactionObj.cstcofins;
                                    break;
                                case '24': // ICMS
                                    taxSituationItem = transactionObj.csticms;
                                    break;
                                case '36': // IPI
                                    taxSituationItem = transactionObj.cstipi;
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

                                if (Number(taxCalculationForm) == 4) {
                                    if (isSubstitutionTax == "T" || isSubstitutionTax == true) {
                                        var mvaList = getMVAByValues(mvaRecords, mcnCode, "", "", subtype_id, taxrate);
                                        if (mvaList.length) {
                                            for (var m = 0; m < mvaList.length; m++) {
                                                var mvaId = mvaList[m]["mvaId"];
                                                stTaxes[mvaId] = stTaxes[mvaId] || [];
                                                stTaxes[mvaId].push({
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
                                                    taxCode: taxCode
                                                });
                                            }
                                        }
                                        continue;
                                    }
                                }

                                var taxamtItem = Math.abs(transactionObj.tax);
                                var netamtItem = Math.abs(transactionObj.net);
                                var grossamtItem = parseFloat(netamtItem) + parseFloat(taxamtItem);
                                var baseDifal = 0;
                                // Brasil : Calculo del Monto Base
                                if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Para el Flujo 0 y 2
                                    amount_to = '3'; // Trabaja con el Net Amount siempre
                                    var suma = parseFloat(sumaPorcentajes(searchResultCC, 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_br_ccl_rate_suma', 'custrecord_lmry_ccl_tax_rule', ruleItem, 'custrecord_lmry_sub_type'));
                                    // Realiza la formula del Monto Base siguiendo la formula "Monto Base = Monto / (1 - suma de porcentajes)"
                                    grossamtItem = parseFloat(grossamtItem / parseFloat(1 - suma));
                                    taxamtItem = parseFloat(taxamtItem / parseFloat(1 - suma));
                                    netamtItem = parseFloat(netamtItem / parseFloat(1 - suma));

                                    if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                                        var sumaBaseCalculoI = baseCalculoBR(0, lineUniqueKey, true);
                                        // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                                        grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                                        netamtItem = parseFloat(netamtItem) - parseFloat(sumaBaseCalculoI);
                                        taxamtItem = parseFloat(taxamtItem) - parseFloat(sumaBaseCalculoI);
                                    }
                                } else { // Para el Flujo 1 y 3
                                    amount_to = '1'; // Trabaja con el Gross Amount siempre
                                    if (taxCalculationForm == 4) {
                                        baseDifal = grossamtItem;
                                        if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                                            var sumaBaseCalculoI = baseCalculoBR(0, lineUniqueKey, true);
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
                                    var retencionAux = round2(retencion)
                                    if (parseFloat(retencion) > 0 || isExempt == true || parseFloat(taxrate) == 0) {
                                        var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                                        // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0, 2, 3
                                        if ((is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm) != -1)) {
                                            baseCalculoBR(parseFloat(retencion), lineUniqueKey, false);
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

                                        var difalAmount = 0.00, difalFxAmount = 0.00;
                                        if (Number(taxCalculationForm) == 4) {
                                            if (difalTaxRate) {
                                                difalFxAmount = parseFloat(baseDifal) * difalTaxRate;
                                                difalAmount = difalFxAmount;
                                                if (exchangeRate != 1) {
                                                    difalAmount = round2(difalAmount) * exchangeRate;
                                                }
                                            }

                                            if (isSubstitutionTax == "F" || isSubstitutionTax == false) {
                                                var mvaList = getMVAByValues(mvaRecords, mcnCode, subtype_id, taxrate);
                                                if (mvaList.length) {
                                                    for (var m = 0; m < mvaList.length; m++) {
                                                        var mvaId = mvaList[m]["mvaId"];
                                                        var mvaRate = mvaList[m]["mvaRate"];
                                                        taxesToST[mvaId] = taxesToST[mvaId] || [];
                                                        taxesToST[mvaId].push({
                                                            mvaRate: mvaRate,
                                                            subType: subtype_id,
                                                            taxRate: parseFloat(taxrate),
                                                            taxRecordId: internalIdCC
                                                        });
                                                    }
                                                }
                                            }


                                            if (isTaxNotIncluded == "T" || isTaxNotIncluded == true) {

                                                if (!taxesNotIncluded[subtype_id]) {
                                                    taxesNotIncluded[subtype_id] = {
                                                        amount: 0.00,
                                                        subType: subtype,
                                                        subTypeId: subtype_id
                                                    }
                                                }

                                                taxesNotIncluded[subtype_id]["amount"] = taxesNotIncluded[subtype_id]["amount"] + retencion;

                                            }
                                        }
                                        jsonArray.push({
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
                                            posicionItem: "",
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
                                            taxCode: taxCode
                                        });
                                        cantidad++;
                                        blnTaxCalculate = true;
                                    }
                                } // Fin Retencion > 0
                            } // Fin FlagItem = true

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
                sumaBaseBR = {};

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
                    }, 'internalid', 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_ntax_amount', 'custrecord_lmry_ntax_sub_type',
                        'custrecord_lmry_ntax_minamount', 'custrecord_lmry_ntax_debit_account', 'custrecord_lmry_ntax_credit_account',
                        'custrecord_lmry_ntax_gl_impact', 'custrecord_lmry_ntax_addratio',
                        'custrecord_lmry_ntax_description', 'custrecord_lmry_ntax_maxamount',
                        'custrecord_lmry_ntax_not_taxable_minimum', 'custrecord_lmry_ntax_base_amount', 'custrecord_lmry_ntax_set_baseretention',
                        'custrecord_lmry_br_ntax_rate_suma', 'custrecord_lmry_ntax_br_receita', 'custrecord_lmry_ntax_isexempt',
                        'custrecord_lmry_br_ntax_tax_situation', 'custrecord_lmry_br_ntax_nature_revenue', 'custrecord_lmry_br_ntax_regimen_catalog',
                        'custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location', 'custrecord_lmry_ntax_difal',
                        'custrecord_lmry_ntax_sub_type.custrecord_lmry_br_is_import_tax', 'custrecord_lmry_nt_br_apply_report',
                        'custrecord_lmry_nt_is_reduction', 'custrecord_lmry_nt_reduction_ratio',
                        'custrecord_lmry_ntax_sub_type.custrecord_lmry_is_tax_not_included', 'custrecord_lmry_nt_is_substitution',
                        'custrecord_lmry_ntax_taxitem', 'custrecord_lmry_ntax_taxcode'
                    ],
                    filters: filtrosNT
                });
                var searchResultNT = searchNT.run().getRange({
                    start: 0,
                    end: 1000
                });

                log.error('LBRY - searchResultNT', searchResultNT.length);
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

                        // Si es Suite GL y debe tomar las Cuentas de la CC y estas están vacias, continua con la siguiente iteracion
                        if (glimpact) {
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

                        if (isImportTax == "T" || isImportTax == true) {
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
                            var idItem = transactionObj.itemValue;

                            var idItemName = transactionObj.itemName;

                            var lineUniqueKey = transactionObj.lineuniquekey;

                            var flagItem = false;

                            // Rule
                            var ruleItem = transactionObj.rule;
                            // Regimen
                            var regimenItem = transactionObj.regimen;
                            var mcnCode = transactionObj.mcnCode;
                            // Tax Situation
                            var taxSituationItem = 0;
                            switch (subtype_id) {
                                case '10': // PIS
                                    taxSituationItem = transactionObj.cstpis;
                                    break;
                                case '11': // COFINS
                                    taxSituationItem = transactionObj.cstcofins;
                                    break;
                                case '24': // ICMS
                                    taxSituationItem = transactionObj.csticms;
                                    break;
                                case '36': // IPI
                                    taxSituationItem = transactionObj.cstipi;
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

                                if (Number(taxCalculationForm) == 4) {
                                    if (isSubstitutionTax == "T" || isSubstitutionTax == true) {
                                        var mvaList = getMVAByValues(mvaRecords, mcnCode, "", "", subtype_id, taxrate);
                                        if (mvaList.length) {
                                            for (var m = 0; m < mvaList.length; m++) {
                                                var mvaId = mvaList[m]["mvaId"];
                                                stTaxes[mvaId] = stTaxes[mvaId] || [];
                                                stTaxes[mvaId].push({
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
                                                    taxCode: taxCode
                                                });
                                            }
                                        }
                                        continue;
                                    }
                                }

                                var taxamtItem = Math.abs(transactionObj.tax);
                                var netamtItem = Math.abs(transactionObj.net);
                                var grossamtItem = parseFloat(netamtItem) + parseFloat(taxamtItem);

                                var baseDifal = 0;

                                // Brasil : Calculo del Monto Base
                                if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Para el Flujo 0 y 2
                                    amount_to = '3'; // Trabaja con el Net Amount siempre
                                    var suma = sumaPorcentajes(searchResultNT, 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_br_ntax_rate_suma', 'custrecord_lmry_ntax_tax_rule', ruleItem, 'custrecord_lmry_ntax_sub_type')
                                    // Realiza la formula del Monto Base siguiendo la formula "Monto Base = Monto / (1 - suma de porcentajes)"
                                    grossamtItem = parseFloat(grossamtItem / parseFloat(1 - suma));
                                    taxamtItem = parseFloat(taxamtItem / parseFloat(1 - suma));
                                    netamtItem = parseFloat(netamtItem / parseFloat(1 - suma));

                                    if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                                        var sumaBaseCalculoI = baseCalculoBR(0, lineUniqueKey, true);
                                        // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                                        grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                                        netamtItem = parseFloat(netamtItem) - parseFloat(sumaBaseCalculoI);
                                        taxamtItem = parseFloat(taxamtItem) - parseFloat(sumaBaseCalculoI);
                                    }
                                } else { // Para el Flujo 1 y 3
                                    amount_to = '1'; // Trabaja con el Gross Amount siempre
                                    if (taxCalculationForm == 4) {
                                        baseDifal = grossamtItem;
                                        if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                                            var sumaBaseCalculoI = baseCalculoBR(0, lineUniqueKey, true);
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
                                    var retencionAux = typeRounding(retencion, rounding);
                                    if (parseFloat(retencion) > 0 || isExempt == true || parseFloat(taxrate) == 0) {
                                        var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                                        // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0, 2, 3
                                        if ((is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm) != -1)) {
                                            baseCalculoBR(parseFloat(retencion), lineUniqueKey, false);
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

                                        var difalAmount = 0.00, difalFxAmount = 0.00;
                                        if (Number(taxCalculationForm) == 4) {
                                            if (difalTaxRate) {
                                                difalFxAmount = parseFloat(baseDifal) * difalTaxRate;
                                                difalAmount = difalFxAmount;
                                                if (exchangeRate != 1) {
                                                    difalAmount = round2(difalAmount) * exchangeRate;
                                                }
                                            }

                                            if (isSubstitutionTax == "F" || isSubstitutionTax == false) {
                                                var mvaList = getMVAByValues(mvaRecords, mcnCode, subtype_id, taxrate);
                                                if (mvaList.length) {
                                                    for (var m = 0; m < mvaList.length; m++) {
                                                        var mvaId = mvaList[m]["mvaId"];
                                                        var mvaRate = mvaList[m]["mvaRate"];
                                                        taxesToST[mvaId] = taxesToST[mvaId] || [];
                                                        taxesToST[mvaId].push({
                                                            mvaRate: mvaRate,
                                                            subType: subtype_id,
                                                            taxRate: parseFloat(taxrate),
                                                            taxRecordId: internalIdNT
                                                        });
                                                    }
                                                }
                                            }

                                            if (isTaxNotIncluded == "T" || isTaxNotIncluded == true) {
                                                if (!taxesNotIncluded[subtype_id]) {
                                                    taxesNotIncluded[subtype_id] = {
                                                        amount: 0.00,
                                                        subType: subtype,
                                                        subTypeId: subtype_id
                                                    }
                                                }

                                                taxesNotIncluded[subtype_id]["amount"] = taxesNotIncluded[subtype_id]["amount"] + retencion;
                                            }
                                        }

                                        jsonArray.push({
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
                                            posicionItem: "",
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
                                            taxCode: taxCode
                                        });
                                        cantidad++;
                                        blnTaxCalculate = true;
                                    }
                                } // Fin Retencion > 0
                            } // Fin FlagItem = true
                        } // Fin Caso 4I : Subsidiaria - Items

                    }
                }

                if (Number(taxCalculationForm) == 4) {
                    log.error("taxesToST", JSON.stringify(taxesToST));
                    log.error("stTaxes", JSON.stringify(stTaxes));
                    log.error("taxesNotIncluded", JSON.stringify(taxesNotIncluded));
                    calculateSubstitutionTaxes(transactionObj, taxesToST, stTaxes, taxesNotIncluded, jsonArray, exchangeRate);
                }
                log.error('LBRY - cantidad', cantidad);
                log.error('LBRY - terminar', 'antes terminar');
                //recordObj.save({ disableTriggers: true, ignoreMandatoryFields: true });
            } catch (error) {
                log.error('LBRY', error);
                return [];
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
            var retAux = parseFloat(Math.round(parseFloat(ret) * 100) / 100);
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
            }
        }

        /***************************************************************************
         * Funcion que realiza la sumatoria de los Impuestos No Excluyentes para la
         * formula del Monto Base de los Impuestos Excluyentes (Pais: Brasil)
         * Parámetros :
         *      retencionBR : impuesto calculado
         *      lineUniqueKey : lineUniquekey del item
         *      isTelecommTax : true: Impuesto Excluyente , false: Impuesto no Excluyente
         **************************************************************************/
        function baseCalculoBR(retencionBR, lineUniqueKey, isTelecommTax) {
            sumaBaseBR[lineUniqueKey] = sumaBaseBR[lineUniqueKey] || 0.00;

            if (!isTelecommTax) {
                sumaBaseBR[lineUniqueKey] = parseFloat(sumaBaseBR[lineUniqueKey] + parseFloat(retencionBR));
            } else {
                return sumaBaseBR[lineUniqueKey];
            }
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
                            RCD_TRANS.setSublistValue('item', 'taxamount', i, 0);
                            RCD_TRANS.setSublistValue('item', 'grossamt', i, round2(base_amount));
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_base_amount', i, '');
                            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_total_impuestos', i, '');
                        }
                    }
                }

                deleteTaxLines(RCD_TRANS);

            } catch (error) {
                log.error('[cleanLinesforCopy]', error);
            }
            return true;
        }

        function createTaxResult(JsonData, internalid, concatBooks, exchangeRate) {
            try {
                var arrayTR = [];
                /****************************************************************************
                 * Agrega las lineas al record LatamReady - Tax Results y genera los Journals
                 ****************************************************************************/
                for (var i = 0; i < JsonData.length; i++) {
                    var recordSummary = record.create({
                        type: 'customrecord_lmry_br_transaction',
                        isDynamic: false
                    });
                    var idTransaction = parseInt(internalid);
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
                        value: JsonData[i].subType
                    });

                    if (JsonData[i].subTypeID) {
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_type_id',
                            value: JsonData[i].subTypeID
                        });
                    }
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_base_amount',
                        value: round4(JsonData[i].baseAmount)
                    });
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_br_total',
                        value: round4(parseFloat(JsonData[i].retencion))
                    });
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_br_percent',
                        value: JsonData[i].taxRate
                    });

                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_total_item',
                        value: 'Line - Item'
                    });
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_item',
                        value: JsonData[i].items
                    });
                    // recordSummary.setValue({
                    //     fieldId: 'custrecord_lmry_br_positem',
                    //     value: parseInt(JsonData[i].posicionItem)
                    // });

                    //Line Unique Key
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_lineuniquekey',
                        value: parseInt(JsonData[i].lineUniqueKey)
                    });


                    if (JsonData[i].caso == '2I') { // Entidad - Items
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_ccl',
                            value: JsonData[i].idCCNT
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_ccl',
                            value: JsonData[i].idCCNT
                        });
                    } else { // Subsidiaria - Items
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_ntax',
                            value: JsonData[i].idCCNT
                        });
                        recordSummary.setValue({
                            fieldId: 'custrecord_lmry_br_ccl',
                            value: JsonData[i].idCCNT
                        });
                    }

                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_accounting_books',
                        value: concatBooks
                    });

                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_tax_description',
                        value: JsonData[i].description
                    });

                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_total_base_currency',
                        value: round4(JsonData[i].localCurrAmt)
                    });

                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_tax_type',
                        value: '4'
                    });
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_br_receta',
                        value: JsonData[i].receita
                    });
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_br_tax_taxsituation',
                        value: JsonData[i].taxSituation
                    });
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_br_tax_nature_revenue',
                        value: JsonData[i].natureRevenue
                    });
                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_br_regimen_asoc_catalog',
                        value: JsonData[i].regimen
                    });

                    recordSummary.setValue({
                        fieldId: 'custrecord_lmry_created_from_script',
                        value: 1
                    });

                    if (JsonData[i].localCurrBaseAmt) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_base_amount_local_currc", value: JsonData[i].localCurrBaseAmt });
                    }
                    if (JsonData[i].localCurrAmt) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_amount_local_currency", value: JsonData[i].localCurrAmt })
                    }
                    if (JsonData[i].localCurrGrossAmt) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_gross_amt_local_curr", value: JsonData[i].localCurrGrossAmt })
                    }

                    if (JsonData[i]["difalTaxRate"]) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_br_difal_alicuota", value: JsonData[i]["difalTaxRate"] });
                    }

                    if (JsonData[i]["difalAmount"]) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_br_difal_amount", value: JsonData[i]["difalAmount"] });
                    }

                    if (JsonData[i]["isApplyReport"]) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_br_apply_report", value: JsonData[i]["isApplyReport"] });
                    }

                    if (JsonData[i]["isImportTax"]) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_br_is_import_tax_result", value: JsonData[i]["isImportTax"] });
                    }

                    if (JsonData[i]["baseNoTributada"]) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_br_base_no_tributada", value: JsonData[i]["baseNoTributada"] });
                    }

                    if (JsonData[i]["baseNoTributadaLocCurr"]) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_base_no_tributad_loc_cur", value: JsonData[i]["baseNoTributadaLocCurr"] });
                    }

                    if (JsonData[i]["isSubstitutionTax"]) {
                        recordSummary.setValue({ fieldId: "custrecord_lmry_is_substitution_tax_resu", value: JsonData[i]["isSubstitutionTax"] });
                    }

                    var idTR = recordSummary.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });

                    JsonData[i]["internalid"] = idTR;

                    arrayTR.push(parseInt(idTR));

                } // Fin For arreglo de retenciones

                return arrayTR;

            } catch (error) {
                log.error('[createTaxResult]', error);
                return [];
            }
        }

        function updateLine(JsonData, recordObj, line, taxCalculationForm) {
            // Si es Brasil y No es Exento, llena la columna "LatamReady - BR Total Taxes" con la sumatoria de los impuestos calculados
            var newAmount_Impuestos = 0;
            var taxRate = 0;

            var searchObj = search.create({
              type: 'salestaxitem',
              columns: [{
                name: 'internalid'
              }, {
                name: 'name'
              }, {
                name: 'internalid',
                join: 'taxType'
              }],
              filters: [
                ["taxtype.country", "anyof", "BR"],
                "AND",
                ["taxtype.isinactive", "is", "F"],
                "AND",
                ["taxtype.doesnotaddtototal", "is", "F"],
                "AND",
                ["taxtype.name", "is", "VAT_BR"],
                "AND",
                ["name", "startswith", "UNDEF"],
                "AND",
                ["isinactive", "is", "F"]
              ]
            }).run().getRange(0, 10);

            var searchColumns = searchObj[0].columns;
            var taxCode = searchObj[0].getValue(searchColumns[0]);
            var taxType = searchObj[0].getValue(searchColumns[2]);

            for (var i = 0; i < JsonData.length; i++) {
                var exempt = JsonData[i].isExempt;
                if (exempt == false) {
                    newAmount_Impuestos += parseFloat(Math.round(parseFloat(JsonData[i].retencion) * 100) / 100);
                    taxRate += parseFloat(Math.round(parseFloat(JsonData[i].taxRate) * 100) / 100);
                } // Fin if BR y Exempt = false
            }

            recordObj.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_lmry_br_total_impuestos',
                line: line,
                value: newAmount_Impuestos
            });

            log.error('LBRY - newAmount_Impuestos', newAmount_Impuestos);

            var featureMultiPrice = runtime.isFeatureInEffect({ feature: 'multprice' });

            /*************************************************************************************
             * Si es Brasil, actualiza los montos de linea de la transaccion dependiendo del flujo
             *************************************************************************************/
            //for (var i = 0; i < cantidad_items; i++) {
            var totalTaxItem = newAmount_Impuestos;
            totalTaxItem = parseFloat(totalTaxItem);

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

            var taxDetailsReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: line });
            var grossItem = parseFloat( recordObj.getSublistValue({ sublistId: 'item', fieldId: 'grossamt', line: line }));

            recordObj.setValue({ fieldId: 'taxdetailsoverride', value: true });
            // deleteTaxDetailsLines(recordObj);

            if (totalTaxItem > 0) {
                switch (taxCalculationForm) {

                    case '1': // Flujo 0: Del Net
                        // Setea los nuevos valores al item
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: line, value: taxDetailsReference });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: line, value: taxType });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: line, value: taxCode });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: line, value: netamtItem });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: line, value: taxRate });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: line, value: totalTaxItem });

                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: line, value: parseFloat( Math.round( parseFloat( netamtItem ) * 100 ) / 100 ) });
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: line, value: parseFloat( Math.round( parseFloat( totalTaxItem ) * 100 ) / 100 ) });

                        break;

                    case '2': // Flujo 1: Del Gross

                        grossItem = parseFloat(grossItem);
                        var netItem = grossItem - totalTaxItem;
                        var rateItem = parseFloat(netItem) / quantityItem;
                        // Setea los nuevos valores al item
                        if (featureMultiPrice == true || featureMultiPrice == 'T') {
                          recordObj.setSublistValue('item', 'price', line, -1);
                        }

                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: line, value: taxDetailsReference });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: line, value: taxType });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: line, value: taxCode });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: line, value: grossItem });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: line, value: taxRate });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: line, value: totalTaxItem });

                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: line, value: parseFloat( Math.round( parseFloat( rateItem ) * 100) / 100) });
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: line, value: parseFloat( Math.round( parseFloat( netItem ) * 100) / 100) });
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: line, value: parseFloat(Math.round(parseFloat(grossItem) * 100) / 100) });
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: line, value: parseFloat(Math.round(parseFloat(totalTaxItem) * 100) / 100) });

                        break;

                    case '3': // Flujo 2: Del Neto + Impuesto

                        var netItem = netamtItem + totalTaxItem;
                        var rateItem = parseFloat(netItem) / quantityItem;
                        // Si no tiene retenciones
                        if (featureMultiPrice == true || featureMultiPrice == 'T') {
                          recordObj.setSublistValue('item', 'price', line, -1);
                        }

                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: line, value: taxDetailsReference });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: line, value: taxType });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: line, value: taxCode });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: line, value: netamtItem });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: line, value: taxRate });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: line, value: 0.0 });

                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: line, value: parseFloat( Math.round( parseFloat( rateItem ) * 100) / 100) });
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: line, value: parseFloat( Math.round( parseFloat( netItem ) * 100) / 100) });
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: line, value: parseFloat(Math.round(parseFloat(netamtItem) * 100) / 100) });
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: line, value: parseFloat(Math.round(parseFloat(totalTaxItem) * 100) / 100) });

                        break;

                    case '4': // Flujo 3: Del Gross

                        grossItem = parseFloat(grossItem);
                        // Setea los nuevos valores al item
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: line, value: taxDetailsReference });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: line, value: taxType });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: line, value: taxCode });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: line, value: grossItem });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: line, value: taxRate });
                        recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: line, value: 0.0 });

                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: line, value: parseFloat(Math.round(parseFloat(grossItem) * 100) / 100) });
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: line, value: parseFloat(Math.round(parseFloat(totalTaxItem) * 100) / 100) });

                        break;
                }
            }
            //}
        }

        function deleteTaxDetailsLines(recordObj) {

          try {

            var getTaxLineCount = recordObj.getLineCount({ sublistId: 'taxdetails' });
            if(getTaxLineCount > 0 && getTaxLineCount) {
              for(var i = getTaxLineCount-1; i >= 0; i--) {
                recordObj.removeLine({ sublistId: 'taxdetails', line: i });
              }
            }

          } catch (e) {
            log.error('[ Automatic ST Purchase - deleteTaxDetailsLines ]', e);
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

        function getmvaRecords(subsidiary) {
            var mvaRecords = {};
            var filters = [
                ["isinactive", "is", "F"]
            ];

            var FEAT_SUBS = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

            if (FEAT_SUBS) {
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

        function calculateSubstitutionTaxes(transactionObj, taxesToST, stTaxes, taxesNotIncluded, jsonArray, exchangeRate) {
            var item = transactionObj.itemValue;
            var itemName = transactionObj.itemName;
            var lineUniqueKey = transactionObj.lineuniquekey;
            var netAmt = transactionObj.net;
            netAmt = Math.abs(parseFloat(netAmt));
            var taxAmt = transactionObj.tax || 0.00;
            taxAmt = Math.abs(parseFloat(taxAmt));
            var grossAmt = round2(parseFloat(netAmt) + parseFloat(taxAmt));

            var totalTaxesNotIncluded = 0.00;
            for (var tx in taxesNotIncluded) {
                totalTaxesNotIncluded = totalTaxesNotIncluded + (taxesNotIncluded[tx]["amount"] || 0.00)
            }

            for (var mvaId in taxesToST) {
                for (var t = 0; t < taxesToST[mvaId].length; t++) {
                    var tax = taxesToST[mvaId][t];
                    var taxRate = tax["taxRate"];
                    taxRate = parseFloat(taxRate);
                    var mvaRate = tax["mvaRate"];
                    var baseSt = (grossAmt + totalTaxesNotIncluded) * (1 + mvaRate);
                    baseSt = round2(baseSt);
                    if (baseSt) {
                        if (stTaxes[mvaId]) {
                            for (var s = 0; s < stTaxes[mvaId].length; s++) {
                                var stTax = stTaxes[mvaId][s];
                                var stTaxRate = stTax["taxRate"];

                                var stTaxAmount = baseSt * stTaxRate - grossAmt * taxRate;

                                var localCurrBaseAmt = baseSt;
                                var localCurrAmt = stTaxAmount;
                                var localCurrGrossAmt = grossAmt;

                                if (exchangeRate != 1) {
                                    localCurrBaseAmt = round2(baseSt) * exchangeRate;
                                    localCurrAmt = round2(stTaxAmount) * exchangeRate;
                                    localCurrGrossAmt = round2(grossAmt) * exchangeRate;
                                }

                                if (stTaxAmount && stTaxAmount > 0) {
                                    jsonArray.push({
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
                                        posicionItem: "",
                                        receita: stTax["receita"],
                                        taxSituation: stTax["taxSituation"],
                                        natureRevenue: stTax["natureRevenue"],
                                        regimen: stTax["regimen"],
                                        localCurrBaseAmt: localCurrBaseAmt,
                                        localCurrAmt: localCurrAmt,
                                        localCurrGrossAmt: localCurrGrossAmt,
                                        isTaxNotIncluded: true,
                                        isSubstitutionTax: true,
                                        taxItem: stTax["taxItem"],
                                        taxCode: stTax["taxCode"]
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        function addTaxItems(recordObj, taxResults, departmentSetup, classSetup, locationSetup) {
            try {

                deleteTaxLines(recordObj);

                var FEAT_DEPT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
                var FEAT_LOC = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
                var FEAT_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
                var DEPTMANDATORY = runtime.getCurrentUser().getPreference({ name: "DEPTMANDATORY" });
                var LOCMANDATORY = runtime.getCurrentUser().getPreference({ name: "LOCMANDATORY" });
                var CLASSMANDATORY = runtime.getCurrentUser().getPreference({ name: "CLASSMANDATORY" });

                var department = recordObj.getValue("department") || "";
                var class_ = recordObj.getValue("class") || "";
                var location = recordObj.getValue("location") || "";

                var taxItems = {}
                for (var i = 0; i < taxResults.length; i++) {
                    var taxResult = taxResults[i];
                    var subTypeId = taxResult["subTypeID"];
                    var subType = taxResult["subType"];
                    var taxItem = taxResult["taxItem"];
                    var taxAmount = taxResult["retencion"];
                    var taxCode = taxResult["taxCode"];
                    var isTaxNotIncluded = taxResult["isTaxNotIncluded"]

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


                log.error("taxItems", JSON.stringify(taxItems));

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
                        if (FEAT_DEPT == "T" || FEAT_DEPT == true) {
                            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'department', line: lineNum, value: department });
                            if ((DEPTMANDATORY == "T" || DEPTMANDATORY == true) && !department) {
                                recordObj.setSublistValue({ sublistId: 'item', fieldId: 'department', line: lineNum, value: departmentSetup });
                            }
                        }

                        if (FEAT_CLASS == "T" || FEAT_CLASS == true) {
                            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'class', line: lineNum, value: class_ });
                            if ((CLASSMANDATORY == "T" || CLASSMANDATORY == true) && !class_) {
                                recordObj.setSublistValue({ sublistId: 'item', fieldId: 'class', line: lineNum, value: classSetup });
                            }
                        }

                        if (FEAT_LOC == "T" || FEAT_LOC == true) {
                            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'location', line: lineNum, value: location });
                            if ((LOCMANDATORY == "T" || LOCMANDATORY == true) && !location) {
                                recordObj.setSublistValue({ sublistId: 'item', fieldId: 'location', line: lineNum, value: locationSetup });
                            }
                        }
                    }
                }
            } catch (err) {
                log.error("[ addTaxLines ]", err);
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

        return {
            getTaxPurchaseLine: getTaxPurchaseLine,
            createTaxResult: createTaxResult,
            updateLine: updateLine,
            cleanLinesforCopy: cleanLinesforCopy,
            addTaxItems: addTaxItems
            /*deleteTaxResults: deleteTaxResults,
            deleteTaxLines: deleteTaxLines*/
        };

    });
