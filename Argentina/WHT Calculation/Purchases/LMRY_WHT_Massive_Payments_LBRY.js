/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_WHT_Massive_Payments_LBRY.js			          ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Set 22 2017  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/log', 'N/url', 'N/format', 'N/runtime', '../Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],

    function(serverWidget, search, record, log, url, format, runtime, library_send) {

        var aux_separa = '';
        var subsidiary = '';
        var result_setuptax = [];
        var exchange_global = 1;
        var exchange_global_certificado = 1;
        var currencies = [];
        var suma = 0;
        var acumulados_taxgroup = [0, 0, 0, 0, 0, 0];
        var suma_taxgroup = [0, 0, 0, 0, 0, 0]; //GRAVADO, NO GRAVADO, EXENTO E IVA, SUMA, IMPORTE
        var Result_national_taxes;
        var suma_pagos = 0;
        var lista_bills_pagar = [];
        var json_prueba = {
            total_gravado: [],
            total_no_gravado: [],
            total_iva: [],
            total_exento: [],
            total_importe: [],
            total_netogng: [],
            total_id: []
        };
        //ARREGLOS RESTA DE RETENCIONES anteriores
        var ccl_retencion = [];
        var retencion_ccl = [];
        var nt_retencion = [];
        var retencion_nt = [];
        var tran_number = [];
        var tipoRenta = [];
        //ARREGLOS DOC FISCAL
        var docfiscal_bill = [];
        var docfiscal_id = [];
        //ARREGLOS TODA LA INFO
        var arregloAuxiliar = [];
        var contadorAuxiliar = 0;
        //BANDERAS
        var arregloBanderas = [false, false, false, false, false, false, false, false, false]; //MINIMOS, ACUMULADO, MAXIMO, DOBASEAMOUNT, NOIMPONIBLE, SETBASE, 6 SUMARETANTERIORES, ADDACCUMULATEDAMOUNT, MINIMUM RETENTION
        //PARA EL BILL PAYMENT
        var bill_map = [];
        var retenciones_map = [];
        var pagobill_map = [];
        var restante_map = [];
        var aux_suma = 0;

        // SUITETAX
        var ST_FEATURE = false;

        function banderas() {
            return arregloBanderas;
        }

        function reseteo() {
            suma_pagos = 0;
            acumulados_taxgroup = [0, 0, 0, 0, 0, 0];
            suma_taxgroup = [0, 0, 0, 0, 0, 0];
            suma = 0;
            json_prueba = {
                total_gravado: [],
                total_no_gravado: [],
                total_iva: [],
                total_exento: [],
                total_importe: [],
                total_netogng: [],
                total_id: []
            };
            ccl_retencion = [];
            retencion_ccl = [];
            nt_retencion = [];
            retencion_nt = [];
            tran_number = [];
            lista_bills_pagar = [];
        }

        function payment_log(script, idLog, accountingPeriod, vendor, fechaIngresada, currencies, result_setuptax, subsidiary, docfiscal_id, docfiscal_bill, exchange_global, noretention, manual) {

            ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

            var filtros_log = [];
            filtros_log[0] = search.createFilter({
                name: 'custrecord_lmry_wht_ven',
                operator: 'is',
                values: vendor
            });
            filtros_log[1] = search.createFilter({
                name: 'custrecord_lmry_wht_sta',
                operator: 'is',
                values: ['FINALIZADO']
            });
            filtros_log[2] = search.createFilter({
                name: 'custrecord_lmry_wht_per',
                operator: 'is',
                values: accountingPeriod
            });
            filtros_log[3] = search.createFilter({
                name: 'custrecord_lmry_wht_tra',
                operator: 'noneof',
                values: ['@NONE@']
            });
            filtros_log[4] = search.createFilter({
                name: 'custrecord_lmry_wht_sub',
                operator: 'is',
                values: subsidiary
            });

            var search_log = search.create({
                type: 'customrecord_lmry_wht_payments_log',
                filters: filtros_log,
                columns: ['internalid', 'custrecord_lmry_wht_bil', 'custrecord_lmry_wht_exc', 'custrecord_lmry_wht_cur', 'custrecord_lmry_wht_mul', 'custrecord_lmry_wht_bas', 'custrecord_lmry_wht_ven']
            });

            var result_log = search_log.run().getRange({
                start: 0,
                end: 1000
            });

            //NUEVO ACUMULADO
            if (result_log != null && result_log.length > 0) {
                for (var i = 0; i < result_log.length; i++) {
                    var base_retencion = result_log[i].getValue('custrecord_lmry_wht_bas').split(';');
                    var exchange_pasados = 1;

                    /*if(currencies[0] == result_setuptax[3] && result_log[i].getText({name: 'custrecord_lmry_wht_cur'}) == result_setuptax[3]){
                    }*/

                    if (result_setuptax[3] == currencies[0] && result_setuptax[3] != result_log[i].getText({
                            name: 'custrecord_lmry_wht_cur'
                        })) {
                        exchange_pasados = result_log[i].getValue('custrecord_lmry_wht_exc');
                    }

                    /*if(result_setuptax[3] == result_log[i].getText({name: 'custrecord_lmry_wht_cur'}) && result_setuptax[3] != currencies[0]){
                    }*/

                    if (result_setuptax[3] != result_log[i].getText({
                            name: 'custrecord_lmry_wht_cur'
                        }) && result_setuptax[3] != currencies[0]) {
                        var multib_before = result_log[i].getValue('custrecord_lmry_wht_mul');
                        var mr_book = multib_before.split("|");
                        for (var t = 0; t < mr_book.length - 1; t++) {
                            var mr_book2 = mr_book[t].split(";");
                            if (mr_book2[0] == result_setuptax[3]) {
                                exchange_pasados = mr_book2[1];
                                break;
                            }
                        }
                    }

                    //log.error(result_log[i].getValue('internalid'),base_retencion);

                    acumulados_taxgroup[0] = acumulados_taxgroup[0] + parseFloat(base_retencion[0]);
                    acumulados_taxgroup[1] = acumulados_taxgroup[1] + parseFloat(base_retencion[1]);
                    acumulados_taxgroup[2] = acumulados_taxgroup[2] + parseFloat(base_retencion[2]);
                    acumulados_taxgroup[3] = acumulados_taxgroup[3] + parseFloat(base_retencion[3]);
                    acumulados_taxgroup[4] = acumulados_taxgroup[4] + parseFloat(base_retencion[4]);
                    acumulados_taxgroup[5] = acumulados_taxgroup[5] + parseFloat(base_retencion[5]);

                }
            }

            //NOTA DE CREDITO
            var current_log = search.lookupFields({
                type: 'customrecord_lmry_wht_payments_log',
                id: idLog,
                columns: ['custrecord_lmry_wht_bil', 'custrecord_lmry_wht_ven', 'custrecord_lmry_wht_cre']
            });
            var _bil = current_log.custrecord_lmry_wht_bil;
            var _credit = current_log.custrecord_lmry_wht_cre;
            var auxCredit = current_log.custrecord_lmry_wht_cre;

            var json_credit = {};

            if (_credit) {
                var _credit = JSON.parse(_credit);

                for (var i in _credit) {
                    json_credit[i] = [0, 0, 0, 0, 0, 0];
                    for (var j in _credit[i]) {

                        json_credit[i][5] += parseFloat(_credit[i][j]['amount']);

                        if (!_credit[i][j]['anticipo']) {
                            json_credit[i][0] += parseFloat(_credit[i][j]['exento']);
                            json_credit[i][1] += parseFloat(_credit[i][j]['iva']);
                            json_credit[i][2] += parseFloat(_credit[i][j]['gravado']);
                            json_credit[i][3] += parseFloat(_credit[i][j]['nogravado']);
                            json_credit[i][4] += parseFloat(_credit[i][j]['gravado']) + parseFloat(_credit[i][j]['nogravado']);

                        }
                    }
                }
            }

            log.error('json_credit', JSON.stringify(json_credit));

            //SUMA DEL PAGO ACTUAL [CONTINUACION DE PARAGUAY]
            var separa = _bil.split("|");

            var porcet_pagos = [];
            var json_auxiliar = {};

            for (var y = 0; y < separa.length - 1; y++) {
                var another_split = separa[y].split(";");
                suma_pagos = parseFloat(suma_pagos) + parseFloat(another_split[1]);
                lista_bills_pagar.push(another_split[0]);

                if (auxCredit) {
                    if (json_credit.hasOwnProperty(another_split[0])) {
                        another_split[3] = parseFloat(another_split[3]) - parseFloat(json_credit[another_split[0]][5]);
                        another_split[3] = parseFloat(another_split[3]).toFixed(2);
                    }
                }

                json_auxiliar[another_split[0]] = parseFloat(another_split[1]) / parseFloat(another_split[3]);
                porcet_pagos.push(parseFloat(another_split[1]) / parseFloat(another_split[3]));

            }

            suma_pagos = parseFloat(suma_pagos) / parseFloat(exchange_global);

            var search_bill = search.load({
                id: 'customsearch_lmry_pay_vendor_bill'
            });
            search_bill.filters.push(search.createFilter({
                name: 'internalid',
                operator: 'anyof',
                values: lista_bills_pagar
            }));
            search_bill.filters.push(search.createFilter({
                name: 'mainline',
                operator: 'is',
                values: 'T'
            }));
            var result_bill = search_bill.run().getRange({
                start: 0,
                end: 1000
            });
            log.error('[ lista_bills_pagar ]', lista_bills_pagar);
            log.error('[ result_bill ]', result_bill);
            for (var j = 0; j < lista_bills_pagar.length; j++) {
                for (var k = 0; k < result_bill.length; k++) {
                    var colFields_bill = result_bill[0].columns;
                    if (ST_FEATURE == true || ST_FEATURE == "T") {
                        var transactionID = result_bill[k].getValue(colFields_bill[14]);
                    } else {
                        var transactionID = result_bill[k].getValue(colFields_bill[16]);
                    }
                    if (transactionID == lista_bills_pagar[j]) {

                        if (result_bill[k].getValue(colFields_bill[4]) == null || result_bill[k].getValue(colFields_bill[4]) == '') {
                            tran_number.push('notrannumber');
                        } else {
                            tran_number.push(result_bill[k].getValue(colFields_bill[4]));
                        }

                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            var TipoRenta = result_bill[k].getValue(colFields_bill[19])
                        } else {
                            var TipoRenta = result_bill[k].getValue(colFields_bill[21]);
                        }
                        if (TipoRenta == null || TipoRenta == '') {
                            tipoRenta.push('notiporenta');
                        } else {
                            tipoRenta.push(TipoRenta);
                        }

                        //amon_gross_pa.push(result_bill[k].getValue(colFields_bill[15]))
                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            var aux_exento = result_bill[k].getValue(colFields_bill[15]);
                        } else {
                            var aux_exento = result_bill[k].getValue(colFields_bill[17]);
                        }
                        if (aux_exento == null || aux_exento == '') {
                            aux_exento = 0;
                        }

                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            var aux_iva = result_bill[k].getValue(colFields_bill[16]);
                        } else {
                            var aux_iva = result_bill[k].getValue(colFields_bill[18]);
                        }
                        if (aux_iva == null || aux_iva == '') {
                            aux_iva = 0;
                        }

                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            var aux_gravado = result_bill[k].getValue(colFields_bill[17]);
                        } else {
                            var aux_gravado = result_bill[k].getValue(colFields_bill[19]);
                        }
                        if (aux_gravado == null || aux_gravado == '') {
                            aux_gravado = 0;
                        }

                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            var aux_nogravado = result_bill[k].getValue(colFields_bill[18]);
                        } else {
                            var aux_nogravado = result_bill[k].getValue(colFields_bill[20]);
                        }
                        if (aux_nogravado == null || aux_nogravado == '') {
                            aux_nogravado = 0;
                        }

                        var aux_gravaynogra = parseFloat(aux_nogravado) + parseFloat(aux_gravado);

                        if (ST_FEATURE == true || ST_FEATURE == "T") {
                            var aux_importe = result_bill[k].getValue(colFields_bill[13]);
                        } else {
                            var aux_importe = result_bill[k].getValue(colFields_bill[15]);
                        }

                        if (auxCredit) {
                            if (json_credit[lista_bills_pagar[j]] != '' && json_credit[lista_bills_pagar[j]] != null && json_credit[lista_bills_pagar[j]] != undefined) {
                                aux_exento = parseFloat(aux_exento) - parseFloat(json_credit[lista_bills_pagar[j]][0]);
                                aux_exento = Math.round(parseFloat(aux_exento) * 100) / 100;
                                aux_iva = parseFloat(aux_iva) - parseFloat(json_credit[lista_bills_pagar[j]][1]);
                                aux_iva = Math.round(parseFloat(aux_iva) * 100) / 100;
                                aux_gravado = parseFloat(aux_gravado) - parseFloat(json_credit[lista_bills_pagar[j]][2]);
                                aux_gravado = Math.round(parseFloat(aux_gravado) * 100) / 100;
                                aux_nogravado = parseFloat(aux_nogravado) - parseFloat(json_credit[lista_bills_pagar[j]][3]);
                                aux_nogravado = Math.round(parseFloat(aux_nogravado) * 100) / 100;
                                aux_importe = parseFloat(aux_importe) - parseFloat(json_credit[lista_bills_pagar[j]][5]);
                                aux_importe = Math.round(parseFloat(aux_importe) * 100) / 100;
                                aux_gravaynogra = parseFloat(aux_gravaynogra) - parseFloat(json_credit[lista_bills_pagar[j]][4]);
                                aux_gravaynogra = Math.round(parseFloat(aux_gravaynogra) * 100) / 100;
                            }
                        }

                        json_prueba.total_exento.push(parseFloat(aux_exento) / parseFloat(exchange_global));

                        json_prueba.total_iva.push(parseFloat(aux_iva) / parseFloat(exchange_global));

                        json_prueba.total_gravado.push(parseFloat(aux_gravado) / parseFloat(exchange_global));

                        json_prueba.total_no_gravado.push(parseFloat(aux_nogravado) / parseFloat(exchange_global));

                        json_prueba.total_importe.push(parseFloat(aux_importe) / parseFloat(exchange_global));

                        json_prueba.total_netogng.push(parseFloat(aux_gravaynogra) / parseFloat(exchange_global));

                    }
                }
            }

            for (var i = 0; i < json_prueba.total_gravado.length; i++) {
                suma_taxgroup[0] = parseFloat(suma_taxgroup[0]) + parseFloat(json_prueba.total_gravado[i]) * parseFloat(porcet_pagos[i]);
                suma_taxgroup[0] = Math.round(suma_taxgroup[0] * 1000000) / 1000000;
                suma_taxgroup[1] = parseFloat(suma_taxgroup[1]) + parseFloat(json_prueba.total_no_gravado[i]) * parseFloat(porcet_pagos[i]);
                suma_taxgroup[1] = Math.round(suma_taxgroup[1] * 1000000) / 1000000;
                suma_taxgroup[2] = parseFloat(suma_taxgroup[2]) + parseFloat(json_prueba.total_exento[i]) * parseFloat(porcet_pagos[i]);
                suma_taxgroup[2] = Math.round(suma_taxgroup[2] * 1000000) / 1000000;
                suma_taxgroup[3] = parseFloat(suma_taxgroup[3]) + parseFloat(json_prueba.total_iva[i]) * parseFloat(porcet_pagos[i]);
                suma_taxgroup[3] = Math.round(suma_taxgroup[3] * 1000000) / 1000000;
                suma_taxgroup[4] = parseFloat(suma_taxgroup[4]) + parseFloat(json_prueba.total_netogng[i]) * parseFloat(porcet_pagos[i]);
                suma_taxgroup[4] = Math.round(suma_taxgroup[4] * 1000000) / 1000000;
                suma_taxgroup[5] = parseFloat(suma_taxgroup[5]) + parseFloat(json_prueba.total_importe[i]) * parseFloat(porcet_pagos[i]);
            }
            log.error('[ suma_taxgroup ]', suma_taxgroup);
            //BUSQUEDA PAGO ANTERIOR: DETAILS
            var search_details = search.create({
                type: 'customrecord_lmry_wht_details',
                filters: [{
                        name: 'trandate',
                        join: 'custrecord_lmry_wht_bill_payment',
                        operator: 'onorbefore',
                        values: fechaIngresada
                    },
                    {
                        name: 'postingperiod',
                        join: 'custrecord_lmry_wht_bill_payment',
                        operator: 'abs',
                        values: accountingPeriod
                    },
                    {
                        name: 'mainline',
                        join: 'custrecord_lmry_wht_bill_payment',
                        operator: 'is',
                        values: 'T'
                    },
                    {
                        name: 'custrecord_lmry_whtdet_vendor',
                        operator: 'is',
                        values: vendor
                    },
                    {
                        name: 'subsidiary',
                        join: 'custrecord_lmry_wht_bill_payment',
                        operator: 'is',
                        values: subsidiary
                    },
                    {
                        name: 'custrecord_lmry_whtdet_voided',
                        operator: 'noneof',
                        values: '1'
                    }
                ],
                columns: [{
                        name: 'internalid',
                        sort: search.Sort.DESC
                    }, 'custrecord_lmry_wht_bill_payment', 'custrecord_lmry_whtdet_contribclass', 'custrecord_lmry_wht_nationaltax',
                    'custrecord_lmry_whtdet_amount', {
                        name: 'custrecord_lmry_ar_trans_paid_exc',
                        join: 'custrecord_lmry_wht_voucher'
                    }, {
                        name: 'currency',
                        join: 'custrecord_lmry_wht_bill_payment'
                    },
                    {
                        name: 'custrecord_lmry_ar_witaxamt',
                        join: 'custrecord_lmry_wht_voucher'
                    }
                ]
            });

            var result_details = search_details.run().getRange({
                start: 0,
                end: 1000
            });

            var jsonRaCC = {};
            var jsonRaNT = {};

            if (result_details != null && result_details.length > 0) {
                var columns_details = result_details[0].columns;
                //var pago_anterior = result_details[0].getValue(columns_details[1]);

                for (var i = 0; i < result_details.length; i++) {

                    var ccl_pago = result_details[i].getValue(columns_details[2]);
                    var nt_pago = result_details[i].getValue(columns_details[3]);
                    //var retencion_anterior = parseFloat(result_details[i].getValue(columns_details[4]))/parseFloat(exchange_details);
                    var retencion_anterior = result_details[i].getValue(columns_details[7]);

                    if (ccl_pago != null && ccl_pago != '') {
                        if (jsonRaCC[ccl_pago] == null || jsonRaCC[ccl_pago] == undefined) {
                            jsonRaCC[ccl_pago] = parseFloat(retencion_anterior);
                        } else {
                            jsonRaCC[ccl_pago] = parseFloat(jsonRaCC[ccl_pago]) + parseFloat(retencion_anterior);
                        }
                    } else {
                        if (jsonRaNT[nt_pago] == null || jsonRaNT[nt_pago] == undefined) {
                            jsonRaNT[nt_pago] = parseFloat(retencion_anterior);
                        } else {
                            jsonRaNT[nt_pago] = parseFloat(jsonRaNT[nt_pago]) + parseFloat(retencion_anterior);
                        }
                    }
                }


            }

            //COLUMNAS CCL
            var columnas_ccl = ['custrecord_lmry_ar_ccl_taxitem', 'custrecord_lmry_ar_ccl_taxrate', 'internalid', 'custrecord_lmry_ccl_addratio', 'custrecord_lmry_ar_ccl_jurisdib', //4
                'custrecord_lmry_ccl_appliesto', 'custrecord_lmry_amount', 'custrecord_lmry_sub_type', 'custrecord_lmry_ccl_minamount', 'custrecord_lmry_ccl_montaccum', //9
                'custrecord_lmry_ar_ccl_taxrate_pctge', 'custrecord_lmry_ccl_fiscal_doctype', 'custrecord_lmry_ccl_accandmin_with', 'custrecord_lmry_ccl_maxamount', //13
                'custrecord_lmry_ccl_set_baseretention', 'custrecord_lmry_ccl_applies_to_item', 'custrecord_lmry_ccl_applies_to_account', 'custrecord_lmry_ar_ccl_subtype', //17
                'custrecord_lmry_ccl_base_amount', 'custrecord_lmry_ccl_not_taxable_minimum', 'custrecord_lmry_ccl_new_logic', 'custrecord_lmry_ccl_taxcode_group',
                'custrecord_lmry_ccl_add_accumulated', 'custrecord_lmry_ccl_taxtype', 'custrecord_lmry_ar_regimen', 'custrecord_lmry_ar_normas_iibb', 'custrecord_lmry_ar_ccl_taxcode', //26
                'custrecord_lmry_ccl_minimum_retention', 'custrecord_lmry_ccl_income_type'
            ];

            var filtros_ccl = new Array();
            filtros_ccl[0] = search.createFilter({
                name: 'custrecord_lmry_ar_ccl_entity',
                operator: 'anyof',
                values: vendor
            });
            filtros_ccl[1] = search.createFilter({
                name: 'custrecord_lmry_ar_ccl_isexempt',
                operator: 'is',
                values: ['F']
            });
            filtros_ccl[2] = search.createFilter({
                name: 'custrecord_lmry_ccl_taxtype',
                operator: 'is',
                values: [1]
            });
            filtros_ccl[3] = search.createFilter({
                name: 'custrecord_lmry_ar_ccl_fechdesd',
                operator: 'onorbefore',
                values: fechaIngresada
            });
            filtros_ccl[4] = search.createFilter({
                name: 'custrecord_lmry_ar_ccl_fechhast',
                operator: 'onorafter',
                values: fechaIngresada
            });
            filtros_ccl[5] = search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: ['F']
            });
            filtros_ccl[6] = search.createFilter({
                name: 'formulatext',
                operator: 'ISNOTEMPTY',
                formula: '{custrecord_lmry_ccl_appliesto}',
                values: ['']
            });
            filtros_ccl[7] = search.createFilter({
                name: 'custrecord_lmry_ccl_transactiontypes',
                operator: 'anyof',
                values: ['4']
            });
            filtros_ccl[8] = search.createFilter({
                name: 'custrecord_lmry_ccl_gen_transaction',
                operator: 'anyof',
                values: ['3']
            });
            filtros_ccl[9] = search.createFilter({
                name: 'custrecord_lmry_ar_ccl_subsidiary',
                operator: 'is',
                values: subsidiary
            });

            var Search_contri_clas = search.create({
                type: 'customrecord_lmry_ar_contrib_class',
                columns: columnas_ccl,
                filters: filtros_ccl
            });
            var Result_contri_clas = Search_contri_clas.run().getRange({
                start: 0,
                end: 1000
            });
            log.error('[ Result_contri_clas ]', Result_contri_clas);
            var columnas_national = ['custrecord_lmry_ntax_taxitem', 'custrecord_lmry_ntax_taxrate', 'internalid', 'custrecord_lmry_ntax_addratio', 'custrecord_lmry_ntax_jurisdib',
                'custrecord_lmry_ntax_appliesto', 'custrecord_lmry_ntax_amount', 'custrecord_lmry_ntax_sub_type', 'custrecord_lmry_ntax_minamount', 'custrecord_lmry_ntax_montaccum',
                'custrecord_lmry_ntax_taxrate_pctge', 'custrecord_lmry_ntax_fiscal_doctype', 'custrecord_lmry_ntax_accandmin_with', 'custrecord_lmry_ntax_maxamount',
                'custrecord_lmry_ntax_set_baseretention', 'custrecord_lmry_ntax_applies_to_item', 'custrecord_lmry_ntax_applies_to_account', 'custrecord_lmry_ntax_subtype', //17
                'custrecord_lmry_ntax_base_amount', 'custrecord_lmry_ntax_not_taxable_minimum', 'custrecord_lmry_ntax_new_logic', 'custrecord_lmry_ntax_taxcode_group',
                'custrecord_lmry_ntax_add_accumulated', 'custrecord_lmry_ntax_taxtype', 'custrecord_lmry_ntax_regimen', 'custrecord_lmry_ntax_iibb_norma', 'custrecord_lmry_ntax_taxcode',
                'custrecord_lmry_ntax_minimum_retention', 'custrecord_lmry_ntax_income_type'
            ];

            var filtros_nationaltaxes = new Array();
            filtros_nationaltaxes[0] = search.createFilter({
                name: 'custrecord_lmry_ntax_isexempt',
                operator: 'is',
                values: ['F']
            });
            filtros_nationaltaxes[1] = search.createFilter({
                name: 'custrecord_lmry_ntax_taxtype',
                operator: 'is',
                values: [1]
            });
            filtros_nationaltaxes[2] = search.createFilter({
                name: 'custrecord_lmry_ntax_datefrom',
                operator: 'onorbefore',
                values: fechaIngresada
            });
            filtros_nationaltaxes[3] = search.createFilter({
                name: 'custrecord_lmry_ntax_dateto',
                operator: 'onorafter',
                values: fechaIngresada
            });
            filtros_nationaltaxes[4] = search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: ['F']
            });
            filtros_nationaltaxes[5] = search.createFilter({
                name: 'formulatext',
                formula: '{custrecord_lmry_ntax_appliesto}',
                operator: 'ISNOTEMPTY',
                values: ['']
            });
            filtros_nationaltaxes[6] = search.createFilter({
                name: 'custrecord_lmry_ntax_transactiontypes',
                operator: 'anyof',
                values: ['4']
            });
            filtros_nationaltaxes[7] = search.createFilter({
                name: 'custrecord_lmry_ntax_gen_transaction',
                operator: 'anyof',
                values: ['3']
            });
            filtros_nationaltaxes[8] = search.createFilter({
                name: 'custrecord_lmry_ntax_subsidiary',
                operator: 'is',
                values: subsidiary
            });

            var Search_national_taxes = search.create({
                type: 'customrecord_lmry_national_taxes',
                columns: columnas_national,
                filters: filtros_nationaltaxes
            });
            Result_national_taxes = Search_national_taxes.run().getRange({
                start: 0,
                end: 1000
            });

            if (manual != null && manual != '') {
                manual = manual.split("|");
            }

            if (noretention != null && noretention != '') {
                noretention = noretention.split("|");
            }

            for (var i = 0; i < separa.length - 1; i++) {
                var tramo = separa[i].split(";"); //ID-BILL, PAGO BILL, RESTANTE BILL, MONTO TOTAL BILL
                var porcet = json_auxiliar[tramo[0]];

                var posicion_bill = '';
                for (var b = 0; b < lista_bills_pagar.length; b++) {
                    if (lista_bills_pagar[b] == tramo[0]) {
                        posicion_bill = b;
                    }
                }

                var doc_fiscal = '';
                for (var c = 0; c < docfiscal_id.length; c++) {
                    if (docfiscal_bill[c] == tramo[0]) {
                        doc_fiscal = docfiscal_id[c];
                    }
                }

                var orden = 1;

                //PUSHEADO POR BILL
                bill_map.push(tramo[0]);
                pagobill_map.push(tramo[1]);
                restante_map.push(tramo[2]);

                orden = iteracion(script, '0', Result_national_taxes, columnas_national, porcet, posicion_bill, tramo, current_log.custrecord_lmry_wht_ven[0].text, orden, doc_fiscal, exchange_global, manual, noretention, suma, vendor, tramo[1], jsonRaCC, jsonRaNT);
                iteracion(script, '1', Result_contri_clas, columnas_ccl, porcet, posicion_bill, tramo, current_log.custrecord_lmry_wht_ven[0].text, orden, doc_fiscal, exchange_global, manual, noretention, suma, vendor, tramo[1], jsonRaCC, jsonRaNT);
                retenciones_map.push(aux_suma);

                aux_suma = 0;
            }

            aux_separa = separa[0].split(';');
            aux_separa = aux_separa[0];

            log.error('arregloAuxiliar', arregloAuxiliar);
            return arregloAuxiliar;

        }

        function creadoTransacciones(id_log, result_setuptax, subsidiary, date, accountingPeriod, paymentMethod, currency, memo, ap, bank, department, clase, location, rate, accountingbook, cForm, country, vendor, exchangeGlobalCertificado, exchangeGlobal, eft, check, proceso) {

            ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

            var base_retenciones = '';
            for (var i = 0; i < suma_taxgroup.length; i++) {
                base_retenciones += suma_taxgroup[i] + ";";
            }

            var obj_payment = record.transform({
                fromType: record.Type.VENDOR_BILL,
                fromId: aux_separa,
                toType: record.Type.VENDOR_PAYMENT,
                isDynamic: true
            });

            var checkSubsidiary = getCheckNumber(subsidiary);

            if (result_setuptax[4] != null && result_setuptax != '') {
                obj_payment.setValue({
                    fieldId: 'customform',
                    value: result_setuptax[4]
                });
            }
            if (subsidiary != null && subsidiary != '') {
                obj_payment.setValue({
                    fieldId: 'subsidiary',
                    value: subsidiary
                });
            }
            date = format.parse({
                value: date,
                type: format.Type.DATE
            });
            if (date != null && date != '') {
                obj_payment.setValue({
                    fieldId: 'trandate',
                    value: date
                });
            }
            if (accountingPeriod != null & accountingPeriod != "") {
                obj_payment.setValue({
                    fieldId: 'postingperiod',
                    value: accountingPeriod
                });
            }
            if (paymentMethod != null && paymentMethod != '') {
                obj_payment.setValue({
                    fieldId: "custbody_lmry_paymentmethod",
                    value: paymentMethod
                });
            }
            if (currency != null && currency != '') {
                obj_payment.setValue({
                    fieldId: "currency",
                    value: currency
                });
            }

            obj_payment.setValue('memo', '');

            if (memo != null && memo != '') {
                obj_payment.setValue({
                    fieldId: 'memo',
                    value: memo
                });
            }

            if (ap != null && ap != '') {
                obj_payment.setValue({
                    fieldId: 'apacct',
                    value: ap
                });
            }

            if (bank != null && bank != '') {
                obj_payment.setValue({
                    fieldId: 'account',
                    value: bank
                });
            }

            if (department != null && department != '') {
                obj_payment.setValue({
                    fieldId: 'department',
                    value: department
                });
            }

            if (location != null && location != '') {
                obj_payment.setValue({
                    fieldId: 'location',
                    value: location
                });
            }

            if (clase != null && clase != '') {
                obj_payment.setValue({
                    fieldId: 'class',
                    value: clase
                });
            }
            obj_payment.setValue({
                fieldId: 'exchangerate',
                value: rate
            });

            if (eft == true) {
                obj_payment.setValue({
                    fieldId: 'custbody_9997_is_for_ep_eft',
                    value: eft
                });
            }

            //CHECK NUMBER
            if (proceso == '0' && check) {
                obj_payment.setValue({
                    fieldId: 'tranid',
                    value: check
                });
            } else if (proceso == '1' && checkSubsidiary[0]) {
                obj_payment.setValue({
                    fieldId: 'tranid',
                    value: checkSubsidiary[0]
                });
            }

            if (accountingbook != null && accountingbook != '') {
                var c_multibook = obj_payment.getLineCount({
                    sublistId: 'accountingbookdetail'
                });
                for (var c_lineas = 0; c_lineas < c_multibook; c_lineas++) {
                    obj_payment.selectLine({
                        sublistId: 'accountingbookdetail',
                        line: c_lineas
                    });
                    if (obj_payment.getCurrentSublistValue({
                            sublistId: 'accountingbookdetail',
                            fieldId: 'currency'
                        }) == result_setuptax[7]) {
                        obj_payment.setCurrentSublistValue({
                            sublistId: 'accountingbookdetail',
                            fieldId: 'exchangerate',
                            value: exchangeGlobalCertificado
                        });
                        obj_payment.commitLine({
                            sublistId: 'accountingbookdetail'
                        });
                    }
                }
            }

            var impopay_global = 0,
                line_pay = 0,
                recorpay = '';
            var cant_pay = obj_payment.getLineCount({
                sublistId: 'apply'
            });
            log.error('[ cant_pay ]', cant_pay);
            log.error('[ retenciones_map ]', retenciones_map);
            for (var indpay = 0; indpay < cant_pay; indpay++) {
                obj_payment.selectLine({
                    sublistId: 'apply',
                    line: indpay
                });
                docid = obj_payment.getCurrentSublistValue({
                    sublistId: 'apply',
                    fieldId: 'doc'
                });

                for (var d = 0; d < retenciones_map.length; d++) {
                    if (bill_map[d] == docid) {
                        var aux_impopay = pagobill_map[d];
                        //SI HAY RETENCION
                        if (parseFloat(retenciones_map[d]) > 0) {
                            aux_impopay = Math.round(parseFloat(pagobill_map[d]) * 100) / 100 - Math.round(parseFloat(retenciones_map[d]) * 100) / 100;
                            aux_impopay = Math.round(parseFloat(aux_impopay) * 100) / 100;
                        }

                        //Setea el campo de la sublista con tal valor
                        obj_payment.setCurrentSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            value: true
                        });
                        obj_payment.setCurrentSublistValue({
                            sublistId: 'apply',
                            fieldId: 'amount',
                            value: aux_impopay
                        });

                        //aux_impopay = Math.round(parseFloat(aux_impopay)*100)/100;

                        impopay_global = parseFloat(aux_impopay) + parseFloat(impopay_global);
                        line_pay++;
                    }
                }

            }

            if (line_pay > 0) {
                recorpay = obj_payment.save({
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                });
                // cambiar el estado al registro payments log
                if (recorpay != null && recorpay != '') {
                    var id = record.submitFields({
                        type: 'customrecord_lmry_wht_payments_log',
                        id: id_log,
                        values: {
                            custrecord_lmry_wht_sta: 'El pago ha sido generado, se estan generando las retenciones en caso hubiera, espere el estado FINALIZADO',
                            custrecord_lmry_wht_tra: recorpay,
                            custrecord_lmry_wht_pay: recorpay,
                            custrecord_lmry_wht_bas: base_retenciones
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true,
                            disableTriggers: true
                        }
                    });

                    //Actualizacion Correlativo checkNumber
                    if ((proceso == '1' && checkSubsidiary[0]) || (proceso == '0' && checkSubsidiary[0] == check && check)) {
                        record.submitFields({
                            type: 'customrecord_lmry_setup_tax_subsidiary',
                            id: checkSubsidiary[2],
                            values: {
                                custrecord_lmry_setuptax_current_number: checkSubsidiary[1]
                            }
                        });
                    }


                }
            }

            log.error('recordpay', recorpay);

            //DETAILS
            log.error('[ arregloAuxiliar ]', arregloAuxiliar);
            for (var e = 0; e < arregloAuxiliar.length; e++) {
                var arregloContenidoSplit = arregloAuxiliar[e].split('|');
                log.error('[ arregloContenidoSplit ]', arregloContenidoSplit);
                if (arregloContenidoSplit[40] != vendor) {
                    continue;
                }

                var wht_details = record.create({
                    type: 'customrecord_lmry_wht_details',
                    isDynamic: true
                });
                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_sourcetra',
                    value: arregloContenidoSplit[0]
                });
                if (arregloContenidoSplit[19] == 'True') {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_wht_nationaltax',
                        value: arregloContenidoSplit[2]
                    });
                } else {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_whtdet_contribclass',
                        value: arregloContenidoSplit[2]
                    });
                }

                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_vendor',
                    value: vendor
                });
                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_cc_rate',
                    value: arregloContenidoSplit[3]
                });
                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_cc_ratio',
                    value: arregloContenidoSplit[4]
                });

                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_amount',
                    value: arregloContenidoSplit[26]
                });

                //NUEVOS Campos
                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_base_amount_decim',
                    value: arregloContenidoSplit[36]
                });
                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_amount_decimal',
                    value: arregloContenidoSplit[43]
                });

                //
                if (arregloContenidoSplit[38] != null && arregloContenidoSplit[38] != '') {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_whtdet_ccar_jurisd',
                        value: arregloContenidoSplit[38]
                    });
                }
                if (arregloContenidoSplit[39] != null && arregloContenidoSplit[39] != '') {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_whtdet_appliesto',
                        value: arregloContenidoSplit[39]
                    });
                }
                if (arregloContenidoSplit[27] != '' && arregloContenidoSplit[27] != null) {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_whtdet_cc_taxtype',
                        value: arregloContenidoSplit[27]
                    });
                }
                if (arregloContenidoSplit[28] != '' && arregloContenidoSplit[28] != null) {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_whtdet_cc_taxitem',
                        value: arregloContenidoSplit[28]
                    });
                }
                if (arregloContenidoSplit[29] != '' && arregloContenidoSplit[29] != null) {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_whtdet_ccar_subt',
                        value: arregloContenidoSplit[29]
                    });
                }
                if (arregloContenidoSplit[30] != '' && arregloContenidoSplit[30] != null) {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_whtdet_regimen',
                        value: arregloContenidoSplit[30]
                    });
                }

                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_baseamount',
                    value: arregloContenidoSplit[31]
                });
                wht_details.setValue({
                    fieldId: 'custrecord_lmry_whtdet_ccl_nt',
                    value: arregloContenidoSplit[32]
                });
                wht_details.setValue({
                    fieldId: 'custrecord_lmry_wht_bill_payment',
                    value: recorpay
                });
                if (arregloContenidoSplit[33] != '' && arregloContenidoSplit[33] != null) {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_wht_cc_norma',
                        value: arregloContenidoSplit[33]
                    });
                }
                if (arregloContenidoSplit[18] != '' && arregloContenidoSplit[18] != null) {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_whtdet_base_retention',
                        value: arregloContenidoSplit[18]
                    });
                }
                if (arregloContenidoSplit[34] != '' && arregloContenidoSplit[34] != null) {
                    wht_details.setValue({
                        fieldId: 'custrecord_lmry_wht_sub_type',
                        value: arregloContenidoSplit[34]
                    });
                }
                var deta_id = wht_details.save({
                    disableTriggers: true
                });

                var auxRecord = record.transform({
                    fromType: record.Type.VENDOR_BILL,
                    fromId: arregloContenidoSplit[0],
                    toType: record.Type.VENDOR_CREDIT,
                    isDynamic: true
                });
                var objRecord = record.create({
                    type: record.Type.VENDOR_CREDIT,
                    isDynamic: true
                });

                if (result_setuptax[5] != null && result_setuptax[5] != '') {
                    objRecord.setValue({
                        fieldId: 'customform',
                        value: result_setuptax[5]
                    });
                } else {
                    if (cForm != '' && cForm != null) {
                        objRecord.setValue({
                            fieldId: 'customform',
                            value: cForm
                        });
                    }
                }

                objRecord.setValue({
                    fieldId: 'entity',
                    value: auxRecord.getValue({
                        fieldId: 'entity'
                    })
                });
                objRecord.setValue({
                    fieldId: 'subsidiary',
                    value: subsidiary
                });
                objRecord.setValue({
                    fieldId: 'account',
                    value: auxRecord.getValue({
                        fieldId: 'account'
                    })
                });
                objRecord.setValue({
                    fieldId: 'currency',
                    value: auxRecord.getValue({
                        fieldId: 'currency'
                    })
                });
                objRecord.setValue({
                    fieldId: 'trandate',
                    value: date
                });
                objRecord.setValue({
                    fieldId: 'postingperiod',
                    value: accountingPeriod
                });

                //CUADRE LIBROS CONTABLES: REPORTES
                var new_rate = (parseFloat(arregloContenidoSplit[43]) / parseFloat(arregloContenidoSplit[26])) * parseFloat(rate);

                objRecord.setValue({
                    fieldId: 'exchangerate',
                    value: new_rate
                });
                var search_tranid = search.lookupFields({
                    type: search.Type.VENDOR_BILL,
                    id: arregloContenidoSplit[0],
                    columns: ['tranid']
                });
                var result_tranid = search_tranid.tranid;
                var valTranID = "";

                if (result_tranid != null && result_tranid != "") {
                    valTranID = result_tranid;
                } else {
                    valTranID = 'REF-' + arregloContenidoSplit[0];
                }

                objRecord.setValue({
                    fieldId: 'tranid',
                    value: valTranID
                });
                objRecord.setValue({
                    fieldId: 'createdfrom',
                    value: auxRecord.getValue({
                        fieldId: 'createdfrom'
                    })
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_subsidiary_country',
                    value: auxRecord.getValue({
                        fieldId: 'custbody_lmry_subsidiary_country'
                    })
                });

                objRecord.setValue({
                    fieldId: 'custbody_lmry_doc_ref_date',
                    value: ''
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_doc_serie_ref',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_exchange_rate_doc_ref',
                    value: 0
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_serie_retencion',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_wht_base_amount',
                    value: 0
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_numero_er',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_type_report',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_numero_cc',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_numero_sr',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_preimpreso_retencion',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_percep_num',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_fecha_retencion',
                    value: ''
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_iibb_jurisd',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_wht_type',
                    value: ' '
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_invoice_applied',
                    value: ' '
                });

                var memo_subtype = "";
                if (arregloContenidoSplit[11] != null && arregloContenidoSplit[11] != '') {
                    memo_subtype = "Create by LatamReady WHT Payment - " + arregloContenidoSplit[11];
                } else {
                    memo_subtype = "Create by LatamReady WHT Payment - ";
                }

                if (location != null && location != '') {
                    objRecord.setValue({
                        fieldId: 'location',
                        value: location
                    });
                }
                if (department != null && department != '') {
                    objRecord.setValue({
                        fieldId: 'department',
                        value: department
                    });
                }
                if (clase != null && clase != '') {
                    objRecord.setValue({
                        fieldId: 'class',
                        value: clase
                    });
                }

                //  Pago Relacionado
                objRecord.setValue({
                    fieldId: 'custbody_lmry_reference_transaction',
                    value: recorpay
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_reference_transaction_id',
                    value: recorpay
                });
                // Campos LatamReady
                objRecord.setValue({
                    fieldId: 'custbody_lmry_fecha_retencion',
                    value: date
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_impuesto_retenido',
                    value: arregloContenidoSplit[26]
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_wht_base_amount',
                    value: arregloContenidoSplit[31]
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_invoice_applied',
                    value: arregloContenidoSplit[0]
                });
                if (arregloContenidoSplit[38] != null && arregloContenidoSplit[38] != '') {
                    objRecord.setValue({
                        fieldId: 'custbody_lmry_iibb_jurisd',
                        value: arregloContenidoSplit[38]
                    });
                }
                if (arregloContenidoSplit[34] != null && arregloContenidoSplit[34] != '') {
                    objRecord.setValue({
                        fieldId: 'custbody_lmry_wht_type',
                        value: arregloContenidoSplit[34]
                    });
                }

                objRecord.setValue({
                    fieldId: 'custbody_lmry_tasa_retencion',
                    value: arregloContenidoSplit[3]
                });
                objRecord.setValue({
                    fieldId: 'custbody_lmry_wht_details',
                    value: deta_id
                });

                // CheckBox necesario para SuiteTax
                objRecord.setValue({
                    fieldId: 'taxdetailsoverride',
                    value: true
                });

                // --- Agrega una Linea nueva ---
                //Selecciona una nueva linea al final de la sublista
                objRecord.selectNewLine({
                    sublistId: 'item'
                });
                // Linea - Item
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: arregloContenidoSplit[28]
                });
                // Linea - Cantidad
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: "1"
                });
                // Linea - Codigo de Impuesto
                if (ST_FEATURE == false || ST_FEATURE == "F") {
                    objRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxcode',
                        value: arregloContenidoSplit[35]
                    });
                }
                // Linea - Custom Price
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'price',
                    value: "-1"
                });
                // Linea - Rate
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: arregloContenidoSplit[26]
                });
                // LATAM COL - AR ITEM TRIBUTO
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_lmry_ar_item_tributo',
                    value: true
                });
                // LATAM COL - AR PERCEPTION PERCENTAGE
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_lmry_ar_perception_percentage',
                    value: arregloContenidoSplit[3]
                });
                // LATAM COL - AR JURISDICCION IIBB:
                objRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_lmry_ar_col_jurisd_iibb',
                    value: arregloContenidoSplit[38]
                });

                // CAMPOS LOCATION, DEPARTMENT Y CLASS
                if (location != null && location != '') {
                    objRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        value: location
                    });
                }
                if (department != null && department != '') {
                    objRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'department',
                        value: department
                    });
                }
                if (clase != null && clase != '') {
                    objRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'class',
                        value: clase
                    });
                }

                // --- Graba la Linea ---
                objRecord.commitLine({
                    sublistId: 'item'
                });

                if (accountingbook != null && accountingbook != '') {
                    var c_multibook = objRecord.getLineCount({
                        sublistId: 'accountingbookdetail'
                    });
                    for (var c_lineas = 0; c_lineas < c_multibook; c_lineas++) {
                        objRecord.selectLine({
                            sublistId: 'accountingbookdetail',
                            line: c_lineas
                        });
                        if (objRecord.getCurrentSublistValue({
                                sublistId: 'accountingbookdetail',
                                fieldId: 'currency'
                            }) == result_setuptax[7]) {
                            var new_rate = parseFloat(arregloContenidoSplit[43]) / parseFloat(arregloContenidoSplit[26]) * parseFloat(exchangeGlobalCertificado);
                            objRecord.setCurrentSublistValue({
                                sublistId: 'accountingbookdetail',
                                fieldId: 'exchangerate',
                                value: new_rate
                            });
                            objRecord.commitLine({
                                sublistId: 'accountingbookdetail'
                            });
                        }
                    }
                }

                // Aplica el Bill Credit al Bill
                var cant_appl = objRecord.getLineCount({
                    sublistId: 'apply'
                });
                if (cant_appl > 0) {
                    // Inicio - Apply del Vendor Credit
                    for (var h = 0; h < cant_appl; h++) {
                        objRecord.selectLine({
                            sublistId: 'apply',
                            line: h
                        });
                        // Guarda internal id de la factura doc(linea)
                        var docid = objRecord.getCurrentSublistValue({
                            sublistId: 'apply',
                            fieldId: 'doc'
                        });
                        if (docid == arregloContenidoSplit[0]) {
                            objRecord.setCurrentSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                value: true
                            });
                            objRecord.setCurrentSublistValue({
                                sublistId: 'apply',
                                fieldId: 'amount',
                                value: arregloContenidoSplit[26]
                            });
                        }
                    }
                    objRecord.commitLine({
                        sublistId: 'apply'
                    });
                    // Fin - Apply del Vendor Credit
                }

                var cant_item = objRecord.getLineCount({
                    sublistId: 'item'
                });
                if (cant_item > 0) {
                    var recordId = objRecord.save({
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    });

                    // SuiteTax
                    if(ST_FEATURE == true || ST_FEATURE == "T") {
                        setSuiteTaxTransactionFieds(arregloContenidoSplit, recordId);
                    }

                    var aux_det = record.submitFields({
                        type: 'customrecord_lmry_wht_details',
                        id: deta_id,
                        values: {
                            custrecord_lmry_wht_bill_credit: recordId
                        },
                        options: {
                            ignoreMandatoryFields: true,
                            disableTriggers: true
                        }
                    });
                    if (country == 'ARG') {
                        var witaxbamt = arregloContenidoSplit[45],
                            witaxamt;

                        witaxbamt = parseFloat(witaxbamt) / (1 / (parseFloat(exchangeGlobalCertificado)));
                        witaxamt = parseFloat(arregloContenidoSplit[6]) * parseFloat(exchangeGlobalCertificado);

                        var serieCompr = '',
                            witaxseri = '';
                        if (result_setuptax[6] != 'T' && result_setuptax[6] != true) {
                            var NumeroSerie = AR_Serie_Numero(arregloContenidoSplit[38]);
                            serieCompr = NumeroSerie[0];
                            witaxseri = NumeroSerie[1];
                        }

                        //VOUCHER
                        var nuevoRegistro = record.create({
                            type: 'customrecord_lmry_ar_comproban_retencion',
                            isDynamic: true
                        });
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_serie_retencion',
                            value: serieCompr
                        });
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_comp_retencion',
                            value: witaxseri
                        });
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_pago_relacionado',
                            value: recordId
                        }); //BILL CREDIT
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_pago_internalid',
                            value: recorpay
                        }); //BILL PAYMENT
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_proveedor',
                            value: vendor
                        });
                        var aux_exrate = 1 / parseFloat(exchangeGlobalCertificado);
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_trans_paid_exc',
                            value: aux_exrate
                        });
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_trans_paid_id',
                            value: recorpay
                        });
                        var aux_1 = parseFloat(arregloContenidoSplit[42]) / parseFloat(exchangeGlobal);
                        var aux_2 = parseFloat(impopay_global) / parseFloat(exchangeGlobal);
                        aux_2 = Math.round(parseFloat(aux_2) * 10000) / 10000;
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_trans_paid_amo',
                            value: aux_1
                        }); //MONTO DEL BILL PAYMENT
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_billpayment_amo',
                            value: aux_2
                        }); // MONTO QUE HE INGRESADO
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_trans_paid_cur',
                            value: result_setuptax[7]
                        });
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_witaxrate',
                            value: arregloContenidoSplit[3]
                        });
                        var aux_3 = parseFloat(arregloContenidoSplit[37]) / parseFloat(exchangeGlobal);
                        aux_3 = Math.round(parseFloat(aux_3) * 10000) / 10000;
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_total_transaccion',
                            value: aux_3
                        });

                        //2 campos a modificar por el tema de exchangerate
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_witaxbamt',
                            value: Math.round(parseFloat(witaxbamt) * 100) / 100
                        });
                        nuevoRegistro.setValue({
                            fieldId: 'custrecord_lmry_ar_witaxamt',
                            value: Math.round(parseFloat(witaxamt) * 100) / 100
                        });
                        var newRecord = nuevoRegistro.save({
                            disableTriggers: true
                        });
                        var details_comprobante = record.submitFields({
                            type: 'customrecord_lmry_wht_details',
                            id: deta_id,
                            values: {
                                custrecord_lmry_wht_voucher: newRecord
                            },
                            option: {
                                disableTriggers: true
                            }
                        });

                    }
                }

            }

            if (recorpay != null && recorpay != '') {
                //Editar el bill payment sin hacer nada (aplicar bill credits)
                var edit_payment = record.load({
                    type: record.Type.VENDOR_PAYMENT,
                    id: recorpay
                });
                var id_save = edit_payment.save({
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                });

                // Numera los Voucher de forma grupal
                if (result_setuptax[6] == 'T' || result_setuptax[6] == true) {
                    AR_Group_Number(id_save);
                }
            }

        }

        /***********************************************************************
         * Function para llenar los campos de cabecera para SuiteTax y también
         * para llenar las lineas de Tax Detail
         * Parametros:
         *  -
         ***********************************************************************/
        function setSuiteTaxTransactionFieds(arregloContenidoSplit, VC_RecordID) {

            try {

                var VB_RecordObj = record.load({
                    type: record.Type.VENDOR_BILL,
                    id: arregloContenidoSplit[0],
                    isDynamic: false
                });

                var nexus = VB_RecordObj.getValue({ fieldId: "nexus" });
                var transactionType = VB_RecordObj.getValue({ fieldId: "custbody_ste_transaction_type" });
                var subsidiaryTaxRegNum = VB_RecordObj.getValue({ fieldId: "subsidiarytaxregnum" });
                var vendorTaxRegNumber = VB_RecordObj.getValue({ fieldId: "entitytaxregnum" });
                log.error('[ nexus, transactionType, subsidiaryTaxRegNum, vendorTaxRegNumber ]', [nexus, transactionType, subsidiaryTaxRegNum, vendorTaxRegNumber]);
                var VC_RecordObj = record.load({
                    type: record.Type.VENDOR_CREDIT,
                    id: VC_RecordID,
                    isDynamic: true
                });

                VC_RecordObj.setValue({ fieldId: "taxregoverride", value: true });
                VC_RecordObj.setValue({ fieldId: "nexus", value: nexus });
                VC_RecordObj.setValue({ fieldId: "custbody_ste_transaction_type", value: transactionType });
                VC_RecordObj.setValue({ fieldId: "subsidiarytaxregnum", value: subsidiaryTaxRegNum });
                VC_RecordObj.setValue({ fieldId: "entitytaxregnum", value: vendorTaxRegNumber });

                var taxType = search.lookupFields({
                    type: "salestaxitem",
                    id: arregloContenidoSplit[35],
                    columns: [ "custrecord_lmry_ste_setup_tax_type" ]
                }).custrecord_lmry_ste_setup_tax_type[0].value;
                log.error('[ taxType ]', taxType);
                var itemDetailReference = VC_RecordObj.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: 0 });
                log.error('[ itemDetailReference ]', itemDetailReference);
                if (itemDetailReference != null && itemDetailReference != "") {

                    VC_RecordObj.selectNewLine({ sublistId: "taxdetails" });
                    VC_RecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", value: itemDetailReference });
                    VC_RecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", value: taxType });
                    VC_RecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", value: arregloContenidoSplit[35] });
                    VC_RecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: arregloContenidoSplit[26] });
                    VC_RecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: 0.0 });
                    VC_RecordObj.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: 0.0 });
                    VC_RecordObj.commitLine({ sublistId: "taxdetails" });

                }

                VC_RecordObj.save({
                    ignoreMandatoryFields: true,
                    disableTriggers: true,
                    enableSourcing: true
                });

            } catch (e) {
                log.error('[ setSuiteTaxTransactionFieds ]', e);
            }

        }

        function getCheckNumber(subsidiary) {
            var filtros_setuptax = [];
            filtros_setuptax[0] = search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: ['F']
            });
            filtros_setuptax[1] = search.createFilter({
                name: 'custrecord_lmry_setuptax_subsidiary',
                operator: 'anyof',
                values: subsidiary
            });

            var searchCheck = search.create({
                type: 'customrecord_lmry_setup_tax_subsidiary',
                filters: filtros_setuptax,
                columns: ['custrecord_lmry_setuptax_prefix', 'custrecord_lmry_setuptax_minimum_digits', 'custrecord_lmry_setuptax_initial_number', 'custrecord_lmry_setuptax_current_number']
            });
            var resultCheck = searchCheck.run().getRange({
                start: 0,
                end: 1
            });

            var prefix = resultCheck[0].getValue({
                name: 'custrecord_lmry_setuptax_prefix'
            });
            var minimumDigits = resultCheck[0].getValue({
                name: 'custrecord_lmry_setuptax_minimum_digits'
            });
            var currentNumber = resultCheck[0].getValue({
                name: 'custrecord_lmry_setuptax_current_number'
            });

            var checkNumber = '';

            if (parseFloat(currentNumber) >= 0) {
                currentNumber++;
                if (prefix) {
                    checkNumber = prefix;
                }
                if (parseFloat(minimumDigits) >= 0) {
                    if (minimumDigits > (currentNumber + "").length) {
                        for (var i = 0; i < minimumDigits - (currentNumber + "").length; i++) {
                            checkNumber += '0';
                        }

                    }
                }
                checkNumber += currentNumber;
            }

            return [checkNumber, currentNumber, resultCheck[0].id];

        }

        function iteracion(script, bySubsidiary, result, columnas, porcet, posicion, tramo, vendor, orden, docFiscal, exchange_global, manual, noretention, suma, vendorvalue, pagoDeBill, jsonRaCC, jsonRaNT) {

            if (result != null && result.length > 0) {
                for (var k = 0; k < result.length; k++) {
                    var if_monthly = result[k].getValue(columnas[9]);
                    var tax_rate = result[k].getValue(columnas[1]);
                    tax_rate = parseFloat(tax_rate);
                    var tax_item = result[k].getValue(columnas[0]);
                    var ratio = result[k].getValue(columnas[3]);
                    var jurisdiccion_iib = result[k].getText(columnas[4]);
                    var jurisdiccion_iib_value = result[k].getValue(columnas[4]);
                    var sub_type = result[k].getText(columnas[7]);
                    var sub_type_value = result[k].getValue(columnas[7]);
                    var internalid = result[k].getValue(columnas[2]);
                    var appl_to = result[k].getValue(columnas[5]);
                    var amou_to = result[k].getValue(columnas[6]);
                    var amou_to_text = result[k].getText(columnas[6]);
                    var ccl_apli = result[k].getText(columnas[5]);
                    var ccl_apli_value = result[k].getValue(columnas[5]);
                    var ccl_mini = result[k].getValue(columnas[8]);
                    var tax_rate_percentage = result[k].getValue(columnas[10]);
                    var type_fiscal_document = result[k].getValue(columnas[11]);
                    var accumulated_with = result[k].getValue(columnas[12]);
                    var accumulated_with_text = result[k].getText(columnas[12]);
                    var maximo = result[k].getValue(columnas[13]);
                    var setbaseretention = result[k].getValue(columnas[14]);
                    var dobaseamount = result[k].getValue(columnas[18]);
                    var dobaseamount_text = result[k].getText(columnas[18]);
                    var minimonoimponible = result[k].getValue(columnas[19]);
                    var applies_to_item = result[k].getText(columnas[15]);
                    var applies_to_account = result[k].getValue(columnas[16]);
                    var new_logic = result[k].getValue(columnas[20]);
                    var taxcode_group = result[k].getValue(columnas[21]);
                    var taxcode_group_text = result[k].getText(columnas[21]);
                    var add_accumulated = result[k].getValue(columnas[22]);
                    var add_accumulated_text = result[k].getText(columnas[22]);
                    var taxtype = result[k].getValue(columnas[23]);
                    var subtype_ar = result[k].getValue(columnas[17]);
                    var regimen = result[k].getValue(columnas[24]);
                    var norma = result[k].getValue(columnas[25]);
                    var tax_code = result[k].getValue(columnas[26]);
                    var minimum_retention = result[k].getValue(columnas[27]);
                    var tipo_renta = result[k].getText(columnas[28]);
                    var subtype_ar_text = result[k].getText(columnas[17]);

                    var bySubsidiary_text = '';
                    if (bySubsidiary == '0') {
                        bySubsidiary_text = "True";
                    } else {
                        bySubsidiary_text = "False";
                    }
                    log.error('[ Document Type ]', [type_fiscal_document, docFiscal]);
                    if (type_fiscal_document != null && type_fiscal_document != '') {
                        if (docFiscal != type_fiscal_document) {
                            continue;
                        }
                    }
                    log.error('[ taxcode_group ]', taxcode_group);
                    if (taxcode_group == null || taxcode_group == '') {
                        continue;
                    }
                    log.error('[ tipo_renta ]', [tipo_renta, tipoRenta[posicion]]);
                    //INCOME TYPE: tipo de honorario
                    if (tipo_renta != null && tipo_renta != '') {
                        if (tipo_renta != tipoRenta[posicion]) {
                            continue;
                        }
                    }

                    if (setbaseretention == null || setbaseretention == '' || setbaseretention <= 0) {
                        setbaseretention = 0;
                    }

                    if (minimonoimponible == null || minimonoimponible == '' || minimonoimponible <= 0) {
                        minimonoimponible = 0;
                    }

                    if (maximo == null || maximo == '' || maximo <= 0) {
                        maximo = 0;
                    }

                    if (minimum_retention == null || minimum_retention == '' || minimum_retention <= 0) {
                        minimum_retention = 0;
                    }

                    if (ccl_mini == null || ccl_mini == '' || ccl_mini <= 0) {
                        ccl_mini = 0;
                    }

                    if (ratio == null || ratio == '' || ratio <= 0) {
                        ratio = 1;
                    }

                    var acumulado_mensualmente = '';
                    if (if_monthly) {
                        acumulado_mensualmente = 'Yes';
                    } else {
                        acumulado_mensualmente = 'No';
                    }

                    //ACUMULADO, PAGO, MONTO BILL

                    var suma_global = acumulados_taxgroup[0],
                        tra_total_global = suma_taxgroup[0];
                    var amon_global = json_prueba.total_gravado[posicion];

                    switch (taxcode_group) {
                        case '2':
                            suma_global = acumulados_taxgroup[1];
                            tra_total_global = suma_taxgroup[1];
                            amon_global = json_prueba.total_no_gravado[posicion];
                            break;
                        case '3':
                            suma_global = acumulados_taxgroup[2];
                            tra_total_global = suma_taxgroup[2];
                            amon_global = json_prueba.total_exento[posicion];
                            break;
                        case '4':
                            suma_global = acumulados_taxgroup[3];
                            tra_total_global = suma_taxgroup[3];
                            amon_global = json_prueba.total_iva[posicion];
                            log.error('[ suma_global, tra_total_global, amon_global ]', [suma_global, tra_total_global, amon_global]);
                            break;
                        case '5':
                            suma_global = acumulados_taxgroup[4];
                            tra_total_global = suma_taxgroup[4];
                            amon_global = json_prueba.total_netogng[posicion];
                            break;
                        case '6':
                            suma_global = acumulados_taxgroup[5];
                            tra_total_global = suma_taxgroup[5];
                            amon_global = json_prueba.total_importe[posicion];
                            break;
                    }

                    //PORCET DEL BILL QUE ESTA PAGANDO
                    var aux_amount_remaining = parseFloat(amon_global) * parseFloat(porcet);
                    log.error('[ aux_amount_remaining ]', aux_amount_remaining);
                    var tra_total_global_before_resta = tra_total_global;
                    log.error('[ tra_total_global_before_resta ]', tra_total_global_before_resta);
                    tra_total_global = parseFloat(tra_total_global) - parseFloat(minimonoimponible);
                    var bandera = false,
                        casoActual = '',
                        new_base = '',
                        caso_nueva_logica = '';
                    log.error('[ new_logic, if_monthly ]', [new_logic, if_monthly]);
                    if (new_logic) {
                        if (if_monthly) {

                            if (parseFloat(suma_global) + parseFloat(tra_total_global) > ccl_mini) {
                                new_base = parseFloat(suma_global) + parseFloat(tra_total_global);
                                caso_nueva_logica = 1;
                            } else {
                                continue;
                            }
                        } else {
                            if (parseFloat(tra_total_global) > ccl_mini) {
                                new_base = parseFloat(tra_total_global);
                                caso_nueva_logica = 2;
                            } else {
                                continue;
                            }
                        }
                    } else {
                        if (if_monthly) {
                            if (ccl_mini != 0) {
                                if (suma_global > ccl_mini) {
                                    casoActual = "1"; //ACUM, MONTO M !=0 y YA ACUM ERA>=MIN EN ESTA CLASE
                                } else {
                                    if (parseFloat(suma_global) + parseFloat(tra_total_global) > parseFloat(ccl_mini)) {
                                        casoActual = "2"; //ACUM, MONTO M !=0 y CON ESTE PAGO >= MIN EN ESTA CLASE
                                    } else {
                                        bandera = true;
                                        casoActual = "3"; //ACUM, MONTO M !=0 y CON ESTE PAGO <MIN EN ESTA CLASE
                                    }
                                }
                            } else {
                                casoActual = "1"; //CASO NO EXISTE, ACUM PERO SIN MONTO MINIMO
                            }
                        } else {
                            if (ccl_mini != 0) {
                                if (parseFloat(tra_total_global) > parseFloat(ccl_mini)) {
                                    casoActual = "5"; //NO ACUM, MONTO M !=0, IMPORTE >= MINIMO PARA ESTA CLASE
                                } else {
                                    casoActual = "6"; //NO ACUM, MONTO M !=0, IMPORTE < MINIMO PARA ESTA CLASE
                                    bandera = true;
                                }
                            } else {
                                casoActual = "7"; // NO ACUM, MONTO M =0, SI HAY RETENCION
                            }
                        }
                    }

                    //log.error('casoActual',casoActual + "-" + internalid + "-" + caso_nueva_logica);
                    log.error('[ casoActual ]', casoActual);
                    if (bandera) {
                        continue;
                    }

                    var suma_retenciones_anteriores = 0;

                    if (bySubsidiary == '0' && jsonRaNT[internalid] != null && jsonRaNT[internalid] != undefined) {
                        suma_retenciones_anteriores = jsonRaNT[internalid];
                    }

                    if (bySubsidiary == '1' && jsonRaCC[internalid] != null && jsonRaCC[internalid] != undefined) {
                        suma_retenciones_anteriores = jsonRaCC[internalid];
                    }

                    var val = setbaseretention;

                    if (casoActual == "2") {
                        var importe_bienes_servicios = tra_total_global;

                        //MAXIMOS
                        if (parseFloat(maximo) > parseFloat(ccl_mini)) {
                            if (parseFloat(suma_global) + parseFloat(tra_total_global) > maximo) {
                                continue;
                            } else {
                                arregloBanderas[2] = true;

                                if (add_accumulated == '2' || add_accumulated == '3') {
                                    importe_bienes_servicios = parseFloat(importe_bienes_servicios) + parseFloat(suma_global);
                                }

                                if (dobaseamount == '2' || dobaseamount == '5') {
                                    importe_bienes_servicios = parseFloat(importe_bienes_servicios) - parseFloat(ccl_mini);
                                }
                                if (dobaseamount == '3') {
                                    importe_bienes_servicios = parseFloat(ccl_mini);
                                }
                                if (dobaseamount == '4') {
                                    importe_bienes_servicios = parseFloat(maximo);
                                }

                            }


                        } else {
                            //CUANDO NO HAY MAXIMOS
                            if (add_accumulated == '2' || add_accumulated == '3') {
                                importe_bienes_servicios = parseFloat(importe_bienes_servicios) + parseFloat(suma_global);
                            }

                            if (dobaseamount == '2' || dobaseamount == '5') {
                                importe_bienes_servicios = parseFloat(importe_bienes_servicios) - parseFloat(ccl_mini);
                            }
                            if (dobaseamount == '3') {
                                importe_bienes_servicios = parseFloat(ccl_mini);
                            }
                            if (dobaseamount == '4') {
                                importe_bienes_servicios = parseFloat(maximo);
                            }
                        }

                        if (importe_bienes_servicios < 0) {
                            continue;
                        }

                        //Val es la retencion
                        val = parseFloat(val) + parseFloat(importe_bienes_servicios) * parseFloat(tax_rate) * parseFloat(ratio);

                        if (parseFloat(minimum_retention) >= parseFloat(val)) {
                            continue;
                        }

                        if (parseFloat(minimum_retention) > 0) {
                            arregloBanderas[8] = true;
                        }

                        val = parseFloat(val) * parseFloat(aux_amount_remaining) / parseFloat(tra_total_global_before_resta);
                        val = Math.round(parseFloat(val) * 100000000) / 100000000;

                        if (val != null && val != '') {
                            val = parseFloat(val);
                        }

                        /***************************************************
                         * Solo si existe retencion
                         * Debe generar el temporal con retencion cero
                         **************************************************/

                        if (val > 0) {
                            // Carga el arreglo
                            suma_global = parseFloat(suma_global).toFixed(4);
                            val = parseFloat(val) * parseFloat(exchange_global);
                            val = Math.round(parseFloat(val) * 100000000) / 100000000;

                            //REDONDEO
                            var aux_rounding = parseFloat(val) - parseInt(val);
                            if (result_setuptax[4] == '1') {
                                if (aux_rounding < 0.5) {
                                    val = parseInt(val);
                                } else {
                                    val = parseInt(val) + 1;
                                }
                            }
                            if (result_setuptax[4] == '2') {
                                val = parseInt(val);
                            }

                            if (manual != null && manual != '') {
                                for (var x = 0; x < manual.length - 1; x++) {
                                    var aux_manual = manual[x].split(";");
                                    if (aux_manual[0] == tramo[0] && aux_manual[1] == orden) {
                                        //importe_bienes_servicios = parseFloat(aux_manual[2])/parseFloat(exchange_global);
                                        val = aux_manual[3];
                                    }
                                }
                            }

                            var orden_pre = orden;
                            var banderano = false;

                            if (noretention != null && noretention != '') {
                                for (var y = 0; y < noretention.length - 1; y++) {
                                    var aux_noretention = noretention[y].split(";");
                                    if (aux_noretention[0] == tramo[0] && aux_noretention[1] == orden) {
                                        banderano = true;
                                    }
                                }
                            }

                            orden++;

                            if (banderano == true) {
                                continue;
                            }

                            if (Math.round(parseFloat(val) * 100) / 100 < 0.01) {
                                continue;
                            }

                            aux_suma = parseFloat(aux_suma) + parseFloat(Math.round(parseFloat(val) * 100) / 100);

                            arregloAuxiliar[contadorAuxiliar] = tramo[0]; //0
                            arregloAuxiliar[contadorAuxiliar] += "|" + vendor;
                            arregloAuxiliar[contadorAuxiliar] += "|" + internalid;
                            arregloAuxiliar[contadorAuxiliar] += "|" + tax_rate;
                            arregloAuxiliar[contadorAuxiliar] += "|" + ratio; //4
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat(parseFloat((parseFloat(aux_amount_remaining) * parseFloat(exchange_global)).toFixed(4))); //5
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat(Math.round(parseFloat(val) * 10000) / 10000); //6
                            arregloAuxiliar[contadorAuxiliar] += "|" + jurisdiccion_iib; //7
                            arregloAuxiliar[contadorAuxiliar] += "|" + tran_number[posicion];
                            arregloAuxiliar[contadorAuxiliar] += "|" + ccl_apli;
                            arregloAuxiliar[contadorAuxiliar] += "|" + taxcode_group_text; //10
                            arregloAuxiliar[contadorAuxiliar] += "|" + sub_type;
                            arregloAuxiliar[contadorAuxiliar] += "|" + acumulado_mensualmente; //12
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(ccl_mini) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(suma_global) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + amou_to_text; //15
                            arregloAuxiliar[contadorAuxiliar] += "|" + dobaseamount_text;
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(maximo) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(setbaseretention) * parseFloat(exchange_global)).toFixed(4)); //18
                            arregloAuxiliar[contadorAuxiliar] += "|" + bySubsidiary_text; //19
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(minimonoimponible) * parseFloat(exchange_global)).toFixed(4)); //20
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(tra_total_global_before_resta) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat(parseFloat(suma_retenciones_anteriores).toFixed(4)); //22
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(amon_global) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + add_accumulated_text;
                            arregloAuxiliar[contadorAuxiliar] += "|" + orden_pre;
                            arregloAuxiliar[contadorAuxiliar] += "|" + Math.round(parseFloat(val) * 100) / 100; //26
                            arregloAuxiliar[contadorAuxiliar] += "|" + taxtype;
                            arregloAuxiliar[contadorAuxiliar] += "|" + tax_item;
                            arregloAuxiliar[contadorAuxiliar] += "|" + subtype_ar; //29
                            arregloAuxiliar[contadorAuxiliar] += "|" + regimen;
                            arregloAuxiliar[contadorAuxiliar] += "|" + Math.round(parseFloat(importe_bienes_servicios) * parseFloat(exchange_global) * 100) / 100; //31
                            var aux_id = '';
                            if (bySubsidiary == '0') {
                                aux_id = "NT" + internalid;
                            } else {
                                aux_id = "CC" + internalid;
                            }
                            arregloAuxiliar[contadorAuxiliar] += '|' + aux_id; //32
                            arregloAuxiliar[contadorAuxiliar] += '|' + norma; //33
                            arregloAuxiliar[contadorAuxiliar] += '|' + sub_type_value;
                            arregloAuxiliar[contadorAuxiliar] += '|' + tax_code; //35
                            arregloAuxiliar[contadorAuxiliar] += '|' + Math.round(parseFloat(importe_bienes_servicios) * parseFloat(exchange_global) * 10000) / 10000; //36
                            arregloAuxiliar[contadorAuxiliar] += '|' + tramo[3]; //37
                            arregloAuxiliar[contadorAuxiliar] += '|' + jurisdiccion_iib_value; //38
                            arregloAuxiliar[contadorAuxiliar] += '|' + ccl_apli_value; //39
                            arregloAuxiliar[contadorAuxiliar] += '|' + vendorvalue;
                            arregloAuxiliar[contadorAuxiliar] += '|' + tax_rate_percentage;
                            arregloAuxiliar[contadorAuxiliar] += '|' + pagoDeBill; //42
                            arregloAuxiliar[contadorAuxiliar] += '|' + parseFloat(Math.round(parseFloat(val) * 10000) / 10000); //43
                            arregloAuxiliar[contadorAuxiliar] += '|' + Math.round(parseFloat(minimum_retention) * parseFloat(exchange_global) * 10000) / 10000; //44
                            arregloAuxiliar[contadorAuxiliar] += '|' + parseFloat(importe_bienes_servicios) * parseFloat(exchange_global); //45
                            arregloAuxiliar[contadorAuxiliar] += '|' + tipo_renta;
                            arregloAuxiliar[contadorAuxiliar] += '|' + subtype_ar_text; //47

                            contadorAuxiliar++;
                        }
                    } else {
                        if (new_logic == true) {

                            if (maximo > 0) {
                                if (maximo >= new_base) {
                                    arregloBanderas[0] = true;
                                    arregloBanderas[2] = true;
                                    if (dobaseamount == '2') {
                                        new_base = parseFloat(new_base) - parseFloat(ccl_mini);
                                    }
                                    if (dobaseamount == '3') {
                                        new_base = parseFloat(ccl_mini);
                                    }
                                    if (dobaseamount == '4') {
                                        new_base = parseFloat(maximo);
                                    }

                                    if (suma_global < ccl_mini && caso_nueva_logica == '1') {
                                        if (dobaseamount == '5') {
                                            new_base = parseFloat(new_base) - parseFloat(ccl_mini);
                                        }
                                    }
                                } else {
                                    continue;
                                }
                            } else {
                                if (dobaseamount == '2') {
                                    new_base = parseFloat(new_base) - parseFloat(ccl_mini);
                                }
                                if (dobaseamount == '3') {
                                    new_base = parseFloat(ccl_mini);
                                }
                            }

                            if (new_base <= 0) {
                                continue;
                            }
                            tra_total_global = new_base;


                            val = parseFloat(val) + parseFloat(tra_total_global) * parseFloat(tax_rate) * parseFloat(ratio);
                            val = parseFloat(val) - parseFloat(suma_retenciones_anteriores);

                            if (parseFloat(minimum_retention) >= parseFloat(val)) {
                                continue;
                            }

                            if (parseFloat(minimum_retention) > 0) {
                                arregloBanderas[8] = true;
                            }

                            val = parseFloat(val) * parseFloat(aux_amount_remaining) / parseFloat(tra_total_global_before_resta);
                            val = Math.round(parseFloat(val) * 100000000) / 100000000;

                            if (val <= 0) {
                                continue;
                            }

                            if (parseFloat(suma_retenciones_anteriores) > 0) {
                                arregloBanderas[6] = true;
                            }


                        } else {


                            if (parseFloat(maximo) > parseFloat(ccl_mini)) {

                                if (casoActual == 1) {
                                    if (!(maximo > parseFloat(suma_global) + parseFloat(tra_total_global))) {
                                        continue;
                                    }

                                    arregloBanderas[0] = true;
                                    arregloBanderas[2] = true;

                                    if (add_accumulated == '3') {
                                        tra_total_global = parseFloat(tra_total_global) + parseFloat(suma_global);
                                    }

                                    if (dobaseamount == '2') {
                                        tra_total_global = parseFloat(tra_total_global) - parseFloat(ccl_mini);
                                    }
                                    if (dobaseamount == '3') {
                                        tra_total_global = parseFloat(ccl_mini);
                                    }

                                    if (dobaseamount == '4') {
                                        tra_total_global = parseFloat(maximo);
                                    }

                                }

                                if (casoActual == 5 || casoActual == 7) {
                                    log.error('[ maximo - tra_total_global ]', [maximo, tra_total_global]);
                                    if (maximo < parseFloat(tra_total_global)) {
                                        continue;
                                    } else {
                                        arregloBanderas[0] = true;
                                        arregloBanderas[2] = true;
                                        if (dobaseamount == '2' || dobaseamount == '5') {
                                            tra_total_global = parseFloat(tra_total_global) - parseFloat(ccl_mini);
                                        }
                                        if (dobaseamount == '3') {
                                            tra_total_global = parseFloat(ccl_mini);
                                        }
                                        if (dobaseamount == '4') {
                                            tra_total_global = parseFloat(maximo);
                                        }
                                    }
                                }


                            } else {
                                //CUANDO NO HAY MAXIMO

                                if (casoActual == '1') {
                                    arregloBanderas[0] = true;

                                    if (add_accumulated == '3') {
                                        tra_total_global = parseFloat(tra_total_global) + parseFloat(suma_global);
                                    }

                                    if (dobaseamount == '2') {
                                        tra_total_global = parseFloat(tra_total_global) - parseFloat(ccl_mini);
                                    }
                                    if (dobaseamount == '3') {
                                        tra_total_global = parseFloat(ccl_mini);
                                    }

                                }

                                if (casoActual == '5' || casoActual == '7') {
                                    if (dobaseamount == '2' || dobaseamount == '5') {
                                        tra_total_global = parseFloat(tra_total_global) - parseFloat(ccl_mini);
                                    }
                                    if (dobaseamount == '3') {
                                        tra_total_global = parseFloat(ccl_mini);
                                    }
                                }


                            }

                            if (tra_total_global <= 0) {
                                continue;
                            }

                            val = parseFloat(val) + parseFloat(tra_total_global) * parseFloat(tax_rate) * parseFloat(ratio);

                            if (parseFloat(minimum_retention) >= parseFloat(val)) {
                                continue;
                            }

                            if (parseFloat(minimum_retention) > 0) {
                                arregloBanderas[8] = true;
                            }

                            val = parseFloat(val) * parseFloat(aux_amount_remaining) / parseFloat(tra_total_global_before_resta);
                            val = Math.round(parseFloat(val) * 100000000) / 100000000;

                        }

                        if (val != null && val != '') {
                            val = parseFloat(val);
                        }

                        /***************************************************
                         * Solo si existe retencion
                         * Debe generar el temporal con retencion cero
                         **************************************************/

                        if (val > 0) {

                            val = parseFloat(val) * parseFloat(exchange_global);
                            val = Math.round(parseFloat(val) * 100000000) / 100000000;

                            //REDONDEO
                            var aux_rounding = parseFloat(val) - parseInt(val);
                            if (result_setuptax[4] == '1') {
                                if (aux_rounding < 0.5) {
                                    val = parseInt(val);
                                } else {
                                    val = parseInt(val) + 1;
                                }
                            }
                            if (result_setuptax[4] == '2') {
                                val = parseInt(val);
                            }

                            if (manual != null && manual != '') {
                                for (var x = 0; x < manual.length; x++) {
                                    var aux_manual = manual[x].split(";");
                                    if (aux_manual[0] == tramo[0] && aux_manual[1] == orden) {
                                        //tra_total_global = parseFloat(aux_manual[2])/parseFloat(exchange_global);
                                        val = parseFloat(aux_manual[3]);
                                    }
                                }
                            }

                            var banderano = false;
                            var orden_pre = orden;

                            if (noretention != null && noretention != '') {
                                for (var y = 0; y < noretention.length - 1; y++) {
                                    var aux_noretention = noretention[y].split(";");
                                    if (aux_noretention[0] == tramo[0] && aux_noretention[1] == orden) {
                                        banderano = true;
                                    }
                                }
                            }

                            orden++;

                            if (banderano == true) {
                                continue;
                            }

                            if (Math.round(parseFloat(val) * 100) / 100 < 0.01) {
                                continue;
                            }

                            aux_suma = parseFloat(aux_suma) + parseFloat(Math.round(parseFloat(val) * 100) / 100);

                            arregloAuxiliar[contadorAuxiliar] = tramo[0]; //0
                            arregloAuxiliar[contadorAuxiliar] += "|" + vendor;
                            arregloAuxiliar[contadorAuxiliar] += "|" + internalid;
                            arregloAuxiliar[contadorAuxiliar] += "|" + tax_rate;
                            arregloAuxiliar[contadorAuxiliar] += "|" + ratio;
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(aux_amount_remaining) * parseFloat(exchange_global)).toFixed(4)); //5
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat(Math.round(parseFloat(val) * 10000) / 10000); //6
                            arregloAuxiliar[contadorAuxiliar] += "|" + jurisdiccion_iib;
                            arregloAuxiliar[contadorAuxiliar] += "|" + tran_number[posicion];
                            arregloAuxiliar[contadorAuxiliar] += "|" + ccl_apli; //9
                            arregloAuxiliar[contadorAuxiliar] += "|" + taxcode_group_text;
                            arregloAuxiliar[contadorAuxiliar] += "|" + sub_type;
                            arregloAuxiliar[contadorAuxiliar] += "|" + acumulado_mensualmente; //12
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(ccl_mini) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(suma_global) * parseFloat(exchange_global)).toFixed(4)); //14
                            arregloAuxiliar[contadorAuxiliar] += "|" + amou_to_text; //15
                            arregloAuxiliar[contadorAuxiliar] += "|" + dobaseamount_text;
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(maximo) * parseFloat(exchange_global)).toFixed(4)); //17
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(setbaseretention) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + bySubsidiary_text; //19
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(minimonoimponible) * parseFloat(exchange_global)).toFixed(4)); //20
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(tra_total_global_before_resta) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat(parseFloat(suma_retenciones_anteriores).toFixed(4)); //22
                            arregloAuxiliar[contadorAuxiliar] += "|" + parseFloat((parseFloat(amon_global) * parseFloat(exchange_global)).toFixed(4));
                            arregloAuxiliar[contadorAuxiliar] += "|" + add_accumulated_text; //24
                            arregloAuxiliar[contadorAuxiliar] += "|" + orden_pre; //25
                            arregloAuxiliar[contadorAuxiliar] += "|" + Math.round(parseFloat(val) * 100) / 100;
                            arregloAuxiliar[contadorAuxiliar] += "|" + taxtype; //27
                            arregloAuxiliar[contadorAuxiliar] += "|" + tax_item;
                            arregloAuxiliar[contadorAuxiliar] += "|" + subtype_ar; //29
                            arregloAuxiliar[contadorAuxiliar] += "|" + regimen;
                            arregloAuxiliar[contadorAuxiliar] += "|" + Math.round(parseFloat(tra_total_global) * parseFloat(exchange_global) * 100) / 100; //31
                            var aux_id = '';
                            if (bySubsidiary == '0') {
                                aux_id = "NT" + internalid;
                            } else {
                                aux_id = "CC" + internalid;
                            }
                            arregloAuxiliar[contadorAuxiliar] += '|' + aux_id;
                            arregloAuxiliar[contadorAuxiliar] += '|' + norma; //33
                            arregloAuxiliar[contadorAuxiliar] += '|' + sub_type_value;
                            arregloAuxiliar[contadorAuxiliar] += '|' + tax_code; //35
                            arregloAuxiliar[contadorAuxiliar] += '|' + Math.round(parseFloat(tra_total_global) * parseFloat(exchange_global) * 10000) / 10000; //36
                            arregloAuxiliar[contadorAuxiliar] += '|' + tramo[3]; //37
                            arregloAuxiliar[contadorAuxiliar] += '|' + jurisdiccion_iib_value; //38
                            arregloAuxiliar[contadorAuxiliar] += '|' + ccl_apli_value; //39
                            arregloAuxiliar[contadorAuxiliar] += '|' + vendorvalue;
                            arregloAuxiliar[contadorAuxiliar] += '|' + tax_rate_percentage;
                            arregloAuxiliar[contadorAuxiliar] += '|' + pagoDeBill; //42
                            arregloAuxiliar[contadorAuxiliar] += '|' + parseFloat(Math.round(parseFloat(val) * 10000) / 10000); //43
                            arregloAuxiliar[contadorAuxiliar] += '|' + Math.round(parseFloat(minimum_retention) * parseFloat(exchange_global) * 10000) / 10000; //44
                            arregloAuxiliar[contadorAuxiliar] += '|' + parseFloat(tra_total_global) * parseFloat(exchange_global); //45
                            arregloAuxiliar[contadorAuxiliar] += '|' + tipo_renta;
                            arregloAuxiliar[contadorAuxiliar] += '|' + subtype_ar_text; //47

                            contadorAuxiliar++;
                        } // Solo si existe retencion
                    }

                    if (casoActual == "1" || casoActual == "2" || casoActual == "3" || casoActual == "5" || caso_nueva_logica == '1' || caso_nueva_logica == '2') {
                        if (ccl_mini != 0) {
                            arregloBanderas[0] = true;
                        }
                    }

                    if (casoActual == "1" || casoActual == "2" || casoActual == "3" || caso_nueva_logica == '1') {
                        arregloBanderas[1] = true;
                    }

                    if (dobaseamount != null && dobaseamount != '') {
                        arregloBanderas[3] = true;
                    }

                    if (minimonoimponible > 0) {
                        arregloBanderas[4] = true;
                    }

                    if (setbaseretention > 0) {
                        arregloBanderas[5] = true;
                    }

                    /*if(suma_retenciones_anteriores > 0){
                      arregloBanderas[6] = true;
                    }*/

                    if (add_accumulated != null && add_accumulated != '') {
                        arregloBanderas[7] = true;
                    }
                } //FOR
            }

            return orden;

        }

        /********************************************************
         * Para la numeracion del Certificado de Retencion
         * LatamReady - AR WHT Config of Serie
         *******************************************************/

        function AR_Serie_Numero(id_iibb) {

            var ResulSerie = new Array();
            ResulSerie[0] = '';
            ResulSerie[1] = '';

            // Equivalencia de series para cada IIBB
            var SearchSerie = search.load({
                id: 'customsearch_lmry_ar_withholding_cof'
            });

            if (id_iibb != '' && id_iibb != null) {
                var Filter_1 = search.createFilter({
                    name: 'custrecord_lmry_ar_wht_cof_iibb',
                    operator: search.Operator.ANYOF,
                    values: id_iibb
                });
                SearchSerie.filters.push(Filter_1);
            } else {
                var Filter_2 = search.createFilter({
                    name: 'custrecord_lmry_ar_wht_cof_iibb',
                    operator: search.Operator.ANYOF,
                    values: '@NONE@'
                });
                SearchSerie.filters.push(Filter_2);
            }

            var SeriesResult = SearchSerie.run();
            var SeriesRecord = SeriesResult.getRange({
                start: 0,
                end: 1000
            });

            var SeriesLineas = SeriesRecord.length;
            var witaxtype = 0;

            if (SeriesLineas > 0) {
                var columnsSearch = SeriesRecord[0].columns;
                // LATAM - AR COF SERIES
                witaxtype = SeriesRecord[0].getValue({
                    name: columnsSearch[2]
                });
            }

            if (witaxtype == 0) {
                return ResulSerie;
            }

            // Numero correlativo de series de impresion
            var cadena = '0000000000';
            var NumeroPre = '';
            var TipoSerie = search.lookupFields({
                type: 'customrecord_lmry_ar_tipo_certific_serie',
                id: witaxtype,
                columns: ['custrecord_lmry_ar_tip_cert_ser_nom', 'custrecord_lmry_ar_tip_cert_ser_nro', 'custrecord_lmry_ar_tip_cert_ser_dig']
            });
            if (TipoSerie != '' && TipoSerie != null) {
                NumeroPre = TipoSerie.custrecord_lmry_ar_tip_cert_ser_nro;
                NumeroPre = parseInt(NumeroPre) + 1;
                // Formato Numero de Serie
                var cantDigitos = TipoSerie.custrecord_lmry_ar_tip_cert_ser_dig;
                cadena = cadena + NumeroPre.toString();
                cadena = cadena.substring(cadena.length - parseFloat(cantDigitos), cadena.length);
                // Devuelve el nombre de la serie y el correlativo
                ResulSerie[0] = TipoSerie.custrecord_lmry_ar_tip_cert_ser_nom;
                ResulSerie[1] = cadena;
                // Actualiza el correlativo de la serie de impresion

                var id = record.submitFields({
                    type: 'customrecord_lmry_ar_tipo_certific_serie',
                    id: witaxtype,
                    values: {
                        custrecord_lmry_ar_tip_cert_ser_nro: NumeroPre
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });
            }
            return ResulSerie;
        }

        function llenadoSubTabla(subTabla, proceso, arregloBanderas, subsidiary, language) {

            //Traducción de campos
            switch (language) {
                case 'es':
                    // Nombres de campos
                    var LblRet = 'Retención';
                    var LblVend = 'Vendedor';
                    var LblOrd = 'Orden';
                    var LblSource = 'Transacción de Origen (ID Interna)';
                    var LblRef = 'Número de Referencia';
                    var LblApplies = 'Se aplica a';
                    var LblAmTo = 'Monto a';
                    var LblBaseAm = 'Importe Base (Moneda Base)';
                    var LblSub = 'Por Subsidiaria';
                    var LblAmRem = 'Cantidad Restante';
                    var LblPay = 'Pago';
                    var LblSumPrev = 'Suma Retenciones Anteriores (Siempre Pesos)'
                    var LblTaxMin = 'Mínimo no Imponible';
                    var LblRate = 'Tasa';
                    var LblRatio = 'Proporción';
                    var LblAm = 'Monto';
                    var LblMinRet = 'Retención Mínima';
                    var LblMinAm = 'Monto Mínimo';
                    var LblMaxAm = 'Monto Máximo';
                    var LblBaseRet = 'Retención Base';
                    var LblDoBase = 'Hacer la Cantidad Base';
                    var LblMonAc = 'Acumulado Mensual';
                    var LblAcAm = 'Monto Acumulada';
                    var LblAddAc = 'Añadir el Monto Acumulado';
                    var LblARJur = 'AR Jurisdicción';
                    break;

                case 'pt':
                    // Nombres de campos
                    var LblRet = 'Retenção';
                    var LblVend = 'Fornecedor';
                    var LblOrd = 'Pedido';
                    var LblSource = 'Transação de Origem (ID Interno)';
                    var LblRef = 'Referência Numérica';
                    var LblApplies = 'Aplica-se a';
                    var LblAmTo = 'Quantia para';
                    var LblBaseAm = 'Montante Base (Moeda Base)';
                    var LblSub = 'Por Subsidiária';
                    var LblAmRem = 'Montante Restante';
                    var LblPay = 'Pagamento';
                    var LblSumPrev = 'Soma as Retenções Anteriores (Sempre Pesos)'
                    var LblTaxMin = 'Não Tributável Mínimo';
                    var LblRate = 'Taxa';
                    var LblRatio = 'Razão';
                    var LblAm = 'Valor';
                    var LblMinRet = 'Retenção Mínima';
                    var LblMinAm = 'Quantidade Máxima';
                    var LblMaxAm = 'Quantia Máxima';
                    var LblBaseRet = 'Retenção de Base';
                    var LblDoBase = 'Faça o Valor Base';
                    var LblMonAc = 'Acumulado Mensalmente';
                    var LblAcAm = 'Quantidade Acumulada';
                    var LblAddAc = 'Adicionar Quantia Acumulada';
                    var LblARJur = 'Jurisdição AR';
                    break;

                default:
                    // Nombres de campos
                    var LblRet = 'Retention';
                    var LblVend = 'Vendor';
                    var LblOrd = 'Order';
                    var LblSource = 'Source transaction (Internal ID)';
                    var LblRef = ' Number reference';
                    var LblApplies = 'Applies to';
                    var LblAmTo = 'Amount to';
                    var LblBaseAm = 'Base amount (Base currency)';
                    var LblSub = 'By Subsidiary';
                    var LblAmRem = 'Amount remaining';
                    var LblPay = 'Payment';
                    var LblSumPrev = 'Sum previous retentions (Always pesos)'
                    var LblTaxMin = 'Not Taxable minimum';
                    var LblRate = 'Rate';
                    var LblRatio = 'Ratio';
                    var LblAm = 'Amount';
                    var LblMinRet = 'Minimum retention';
                    var LblMinAm = 'Minimum amount';
                    var LblMaxAm = 'Maximum amount';
                    var LblBaseRet = 'Base retention';
                    var LblDoBase = 'Do base amount';
                    var LblMonAc = 'Monthly accumulated';
                    var LblAcAm = 'Accumulated amount';
                    var LblAddAc = 'Add accumulated amount';
                    var LblARJur = 'AR Jurisdiction';
            }

            var check = subTabla.addField({
                id: 'sub_check',
                label: LblRet,
                type: serverWidget.FieldType.CHECKBOX
            });
            check.defaultValue = "T";

            if (proceso == '1') {
                subTabla.addField({
                    id: 'sub_vendor',
                    label: LblVend,
                    type: serverWidget.FieldType.TEXT
                });
            }

            subTabla.addField({
                id: 'sub_pago',
                label: 'PAGO X BILL',
                type: serverWidget.FieldType.TEXT
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            subTabla.addField({
                id: 'sub_id',
                label: LblOrd,
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_transa',
                label: LblSource,
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_tranid',
                label: LblRef,
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_tip_ret',
                label: 'WHT ID',
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_by_subsidiary',
                label: LblSub,
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_appl_to',
                label: LblApplies,
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_amou_to',
                label: LblAmTo,
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_imp_bas',
                label: LblBaseAm,
                type: serverWidget.FieldType.TEXT
            });

            var licenses = library_send.getLicenses(subsidiary);

            if (library_send.getAuthorization(288, licenses) == true) {
                subTabla.addField({
                    id: 'sub_imp_app',
                    label: LblAmRem,
                    type: serverWidget.FieldType.FLOAT
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.ENTRY
                });
            } else {
                subTabla.addField({
                    id: 'sub_imp_app',
                    label: LblAmRem,
                    type: serverWidget.FieldType.TEXT
                });
            }
            subTabla.addField({
                id: 'sub_pago_total',
                label: LblPay,
                type: serverWidget.FieldType.TEXT
            });

            if (arregloBanderas[6]) {
                subTabla.addField({
                    id: 'sub_retenc_anterior',
                    label: LblSumPrev,
                    type: serverWidget.FieldType.TEXT
                });
            }

            if (arregloBanderas[4]) {
                subTabla.addField({
                    id: 'sub_not_tax_min',
                    label: LblTaxMin,
                    type: serverWidget.FieldType.TEXT
                });
            }

            subTabla.addField({
                id: 'sub_por_ret',
                label: LblRate,
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_ratio',
                label: LblRatio,
                type: serverWidget.FieldType.TEXT
            });

            if (library_send.getAuthorization(288, licenses) == true) {
                subTabla.addField({
                    id: 'sub_imp_cal',
                    label: LblAm,
                    type: serverWidget.FieldType.FLOAT
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.ENTRY
                });
            } else {
                subTabla.addField({
                    id: 'sub_imp_cal',
                    label: LblAm,
                    type: serverWidget.FieldType.TEXT
                });
            }

            if (arregloBanderas[8]) {
                subTabla.addField({
                    id: 'sub_retencion_minima',
                    label: LblMinRet,
                    type: serverWidget.FieldType.TEXT
                });
            }

            if (arregloBanderas[0]) {
                subTabla.addField({
                    id: 'sub_monto_minimo',
                    label: LblMinAm,
                    type: serverWidget.FieldType.TEXT
                });
            }

            if (arregloBanderas[2]) {
                subTabla.addField({
                    id: 'sub_monto_maximo',
                    label: LblMaxAm,
                    type: serverWidget.FieldType.TEXT
                });
            }

            if (arregloBanderas[5]) {
                subTabla.addField({
                    id: 'sub_base_retention',
                    label: LblBaseRet,
                    type: serverWidget.FieldType.TEXT
                });
            }

            if (arregloBanderas[3]) {
                subTabla.addField({
                    id: 'sub_substract',
                    label: LblDoBase,
                    type: serverWidget.FieldType.TEXT
                });
            }

            if (arregloBanderas[1]) {
                subTabla.addField({
                    id: 'sub_monthly',
                    label: LblMonAc,
                    type: serverWidget.FieldType.TEXT
                });
                subTabla.addField({
                    id: 'sub_acumulado',
                    label: LblAcAm,
                    type: serverWidget.FieldType.TEXT
                });
            }

            if (arregloBanderas[7]) {
                subTabla.addField({
                    id: 'sub_add_acumulado',
                    label: LblAddAc,
                    type: serverWidget.FieldType.TEXT
                });
            }

            subTabla.addField({
                id: 'sub_tipo',
                label: 'LATAM - TYPE',
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_sb_type',
                label: 'LATAM - SUB TYPE',
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_tipo_renta',
                label: 'LATAM - SUB CLASS',
                type: serverWidget.FieldType.TEXT
            });
            subTabla.addField({
                id: 'sub_jur_iib',
                label: LblARJur,
                type: serverWidget.FieldType.TEXT
            });

            for (var i = 0; i < arregloAuxiliar.length; i++) {
                var colFields = arregloAuxiliar[i].split("|");

                subTabla.setSublistValue({
                    id: 'sub_vendor',
                    line: i,
                    value: colFields[1]
                });
                subTabla.setSublistValue({
                    id: 'sub_id',
                    line: i,
                    value: colFields[25]
                });

                var url_bill = url.resolveRecord({
                    recordType: 'vendorbill',
                    recordId: colFields[0],
                    isEditMode: false
                });
                subTabla.setSublistValue({
                    id: 'sub_transa',
                    line: i,
                    value: '<a href="' + url_bill + '" target="_blank">' + colFields[0] + '</a>'
                });

                if (colFields[19] == 'True') {
                    var url_nt = url.resolveRecord({
                        recordType: 'customrecord_lmry_national_taxes',
                        recordId: colFields[2],
                        isEditMode: false
                    });
                    subTabla.setSublistValue({
                        id: 'sub_tip_ret',
                        line: i,
                        value: '<a href="' + url_nt + '" target="_blank">' + colFields[2] + '</a>'
                    });

                } else {
                    var url_ccl = url.resolveRecord({
                        recordType: 'customrecord_lmry_ar_contrib_class',
                        recordId: colFields[2],
                        isEditMode: false
                    });
                    subTabla.setSublistValue({
                        id: 'sub_tip_ret',
                        line: i,
                        value: '<a href="' + url_ccl + '" target="_blank">' + colFields[2] + '</a>'
                    });
                }

                if (colFields[8] == 'notrannumber') {
                    subTabla.setSublistValue({
                        id: 'sub_tranid',
                        line: i,
                        value: ' '
                    });
                } else {
                    subTabla.setSublistValue({
                        id: 'sub_tranid',
                        line: i,
                        value: colFields[8]
                    });
                }

                subTabla.setSublistValue({
                    id: 'sub_by_subsidiary',
                    line: i,
                    value: colFields[19]
                });
                subTabla.setSublistValue({
                    id: 'sub_appl_to',
                    line: i,
                    value: colFields[9]
                });
                subTabla.setSublistValue({
                    id: 'sub_amou_to',
                    line: i,
                    value: colFields[10]
                });
                subTabla.setSublistValue({
                    id: 'sub_imp_bas',
                    line: i,
                    value: colFields[23]
                });
                subTabla.setSublistValue({
                    id: 'sub_imp_app',
                    line: i,
                    value: colFields[5]
                });
                subTabla.setSublistValue({
                    id: 'sub_pago_total',
                    line: i,
                    value: colFields[21]
                });
                subTabla.setSublistValue({
                    id: 'sub_por_ret',
                    line: i,
                    value: colFields[41]
                });
                subTabla.setSublistValue({
                    id: 'sub_ratio',
                    line: i,
                    value: colFields[4]
                });
                subTabla.setSublistValue({
                    id: 'sub_imp_cal',
                    line: i,
                    value: colFields[6]
                });
                subTabla.setSublistValue({
                    id: 'sub_pago',
                    line: i,
                    value: colFields[42]
                });

                subTabla.setSublistValue({
                    id: 'sub_monto_minimo',
                    line: i,
                    value: colFields[13]
                });
                subTabla.setSublistValue({
                    id: 'sub_monto_maximo',
                    line: i,
                    value: colFields[17]
                });
                subTabla.setSublistValue({
                    id: 'sub_base_retention',
                    line: i,
                    value: colFields[18]
                });
                subTabla.setSublistValue({
                    id: 'sub_not_tax_min',
                    line: i,
                    value: colFields[20]
                });
                subTabla.setSublistValue({
                    id: 'sub_acumulado',
                    line: i,
                    value: colFields[14]
                });
                subTabla.setSublistValue({
                    id: 'sub_monthly',
                    line: i,
                    value: colFields[12]
                });
                subTabla.setSublistValue({
                    id: 'sub_retenc_anterior',
                    line: i,
                    value: colFields[22]
                });
                subTabla.setSublistValue({
                    id: 'sub_retencion_minima',
                    line: i,
                    value: colFields[44]
                });

                if (colFields[16] != '') {
                    subTabla.setSublistValue({
                        id: 'sub_substract',
                        line: i,
                        value: colFields[16]
                    });
                }

                if (colFields[24] != '') {
                    subTabla.setSublistValue({
                        id: 'sub_add_acumulado',
                        line: i,
                        value: colFields[24]
                    });
                }

                if (colFields[11] != '') {
                    subTabla.setSublistValue({
                        id: 'sub_sb_type',
                        line: i,
                        value: colFields[11]
                    });
                }

                if (colFields[46] != '') {
                    subTabla.setSublistValue({
                        id: 'sub_tipo_renta',
                        line: i,
                        value: colFields[46]
                    });
                }

                if (colFields[47] != '') {
                    subTabla.setSublistValue({
                        id: 'sub_tipo',
                        line: i,
                        value: colFields[47]
                    });
                }

                if (colFields[7] != '') {
                    subTabla.setSublistValue({
                        id: 'sub_jur_iib',
                        line: i,
                        value: colFields[7]
                    });
                }

            }
        }


        function llenado_setuptax(sub, docFiscales) {

            subsidiary = sub;

            var filtros_setuptax = new Array();
            filtros_setuptax[0] = search.createFilter({
                name: 'isinactive',
                operator: 'is',
                values: ['F']
            });
            filtros_setuptax[1] = search.createFilter({
                name: 'custrecord_lmry_setuptax_subsidiary',
                operator: 'anyof',
                values: subsidiary
            });

            var search_rounding = search.create({
                type: 'customrecord_lmry_setup_tax_subsidiary',
                filters: filtros_setuptax,
                columns: ['custrecord_lmry_setuptax_amorounding', 'custrecord_lmry_setuptax_type_rounding',
                    'custrecord_lmry_setuptax_apply_line', 'custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_form_payment', 'custrecord_lmry_setuptax_form_credit', 'custrecord_lmry_setuptax_ar_group'
                ]
            });
            var result_rounding = search_rounding.run().getRange({
                start: 0,
                end: 1
            });

            result_setuptax = [];
            if (result_rounding != null && result_rounding.length > 0) {
                result_setuptax.push(result_rounding[0].getValue({
                    name: 'custrecord_lmry_setuptax_amorounding'
                }));
                result_setuptax.push(result_rounding[0].getValue({
                    name: 'custrecord_lmry_setuptax_type_rounding'
                }));
                result_setuptax.push(result_rounding[0].getValue({
                    name: 'custrecord_lmry_setuptax_apply_line'
                }));
                result_setuptax.push(result_rounding[0].getText({
                    name: 'custrecord_lmry_setuptax_currency'
                }));
                result_setuptax.push(result_rounding[0].getValue({
                    name: 'custrecord_lmry_setuptax_form_payment'
                }));
                result_setuptax.push(result_rounding[0].getValue({
                    name: 'custrecord_lmry_setuptax_form_credit'
                }));
                result_setuptax.push(result_rounding[0].getValue({
                    name: 'custrecord_lmry_setuptax_ar_group'
                }));
                result_setuptax.push(result_rounding[0].getValue({
                    name: 'custrecord_lmry_setuptax_currency'
                }));

                log.error('result_setuptax', result_setuptax);

                var caso_rounding = '';
                if (result_setuptax[1] != null && result_setuptax[1] != '') {
                    if (result_setuptax[1] == '1') {
                        caso_rounding = "1";
                    } else {
                        caso_rounding = "2";
                    }
                }
                if (result_setuptax[0] != null && result_setuptax[0] != '') {
                    caso_rounding = "3";
                }
                if (result_setuptax[1] != null && result_setuptax[1] != '' && result_setuptax[0] != null && result_setuptax[0] != '') {
                    caso_rounding = "0";
                }

                result_setuptax.push(caso_rounding);
            }

            var aux_fiscal = docFiscales.split('|');
            for (var i = 0; i < aux_fiscal.length - 1; i++) {
                var cd = aux_fiscal[i].split(';');
                docfiscal_id.push(cd[1]);
                docfiscal_bill.push(cd[0]);
            }

            var retornar = [result_setuptax, docfiscal_id, docfiscal_bill];

            return retornar;

        }

        function multibooking(currency_actual_text, exchange_actual, currency_book) {

            var currency_base = search.lookupFields({
                type: 'subsidiary',
                id: subsidiary,
                columns: ['currency']
            });
            currency_base = currency_base.currency[0].text;

            currencies.push(currency_base);
            currencies.push(currency_actual_text);

            if (result_setuptax[3] == currencies[0]) {
                exchange_global = 1 / parseFloat(exchange_actual);
                exchange_global_certificado = exchange_actual;
            }
            if ((currency_actual_text == result_setuptax[3]) && (currency_actual_text == currency_base)) {
                exchange_global = exchange_actual;
                exchange_global_certificado = exchange_actual;
            }

            if ((result_setuptax[3] != currency_base) && (result_setuptax[3] != currency_actual_text)) {
                var aux_cbook = currency_book.split("|");
                for (var h = 0; h < aux_cbook.length - 1; h++) {
                    var aux_cbook2 = aux_cbook[h].split(";");
                    if (aux_cbook2[0] == result_setuptax[3]) {
                        exchange_global = 1 / parseFloat(aux_cbook2[1]);
                        exchange_global_certificado = parseFloat(aux_cbook2[1]);
                    }
                }
            }

            currencies.push(exchange_global);
            currencies.push(exchange_global_certificado);

            return currencies;
        }

        /********************************************************
         * Funcion para numerar de forma grupal las retenciones
         * Realizadas por clase contributiva y National Tax
         *******************************************************/

        function AR_Group_Number(PaymentID) {
            try {
                var search_transac = search.create({
                    type: "customrecord_lmry_wht_details",
                    filters: [
                        ["custrecord_lmry_wht_bill_credit", "noneof", "@NONE@"],
                        "AND",
                        ["custrecord_lmry_wht_voucher", "noneof", "@NONE@"],
                        "AND",
                        ["custrecord_lmry_wht_bill_credit.mainline", "is", "T"],
                        "AND",
                        ["custrecord_lmry_wht_bill_payment.mainline", "is", "T"],
                        "AND",
                        ["custrecord_lmry_wht_bill_payment.internalidnumber", "equalto", PaymentID],
                        "AND",
                        ["custrecord_lmry_whtdet_sourcetra.mainline", "is", "T"]
                    ],
                    columns: [
                        search.createColumn({
                            name: "internalid",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "formulatext",
                            formula: "{custrecord_lmry_wht_nationaltax} || {custrecord_lmry_whtdet_contribclass}",
                            sort: search.Sort.ASC,
                            label: "Formula (Text)"
                        }),
                        search.createColumn({
                            name: "custrecord_lmry_whtdet_ccar_jurisd",
                            sort: search.Sort.ASC,
                            label: "Latam - WHT CC AR Jurisdiction"
                        }),
                        search.createColumn({
                            name: "custrecord_lmry_whtdet_cc_rate",
                            sort: search.Sort.ASC,
                            label: "Latam - WHT CC Rate"
                        }),
                        search.createColumn({
                            name: "custrecord_lmry_wht_voucher",
                            label: "Latam - WHT Voucher"
                        })
                    ]
                });
                var resul_transac = search_transac.run();
                var detailsSearch = resul_transac.getRange({
                    start: 0,
                    end: 1000
                });

                if (detailsSearch.length > 0) {
                    // Auxiliar para el quiebre de numeracion
                    var datoauxi = '';
                    // Variables de Serie y Numero de retencion
                    var serieComp = '';
                    var witaxSeri = '';

                    // Correo todos los vouchers
                    for (var i = 0; i < detailsSearch.length; i++) {
                        // Inicializa variables
                        var colFields = detailsSearch[i].columns;
                        var datogrou = "" + detailsSearch[i].getValue({
                            name: colFields[1]
                        });
                        var datojuri = "" + detailsSearch[i].getValue({
                            name: colFields[2]
                        });
                        var datorate = "" + detailsSearch[i].getValue({
                            name: colFields[3]
                        });
                        var datovouc = "" + detailsSearch[i].getValue({
                            name: colFields[4]
                        });

                        // Coloca la serie de custbody_lmry_preimpreso_retencion
                        if (datogrou != datoauxi) {
                            datoauxi = datogrou;
                            // Obtiene el numero de Serie
                            var NumeroSerie = AR_Serie_Numero(datojuri);
                            serieComp = NumeroSerie[0];
                            witaxSeri = NumeroSerie[1];
                        } // Fin Serie

                        // Actualiza el voucher
                        var id = record.submitFields({
                            type: 'customrecord_lmry_ar_comproban_retencion',
                            id: datovouc,
                            values: {
                                custrecord_lmry_ar_serie_retencion: serieComp,
                                custrecord_lmry_ar_comp_retencion: witaxSeri
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true,
                                disableTriggers: true
                            }
                        });
                    } // Fin For
                } // Fin validar cantidad
            } catch (msgerror) {
                log.error('AR_Group_Number - msgerr', msgerror);
                //library.sendemail(' [ AR_Group_Number ] ' + msgerror, LMRY_script);
            }
        }

        return {
            payment_log: payment_log,
            multibooking: multibooking,
            llenado_setuptax: llenado_setuptax,
            llenadoSubTabla: llenadoSubTabla,
            banderas: banderas,
            creadoTransacciones: creadoTransacciones,
            reseteo: reseteo
        };

    });
