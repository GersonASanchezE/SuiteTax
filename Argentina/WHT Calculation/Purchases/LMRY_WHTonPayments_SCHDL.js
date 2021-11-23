/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_WHTonPayments_SCHDL.js                      ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Set 22 2017  LatamReady    Use Script 2.0           ||
\= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 */
define(['N/log', 'N/record', 'N/search', 'N/format', 'N/runtime', 'N/email','N/config','./Latam_Library/LMRY_libSendingEmailsLBRY_V2.0','./WTH_Library/LMRY_WHT_Massive_Payments_LBRY'],

    function(log, record, search, format, runtime, email, config,library,library_wht) {
        // Nombre del Script
        var LMRY_script = "Latamready WHT on Payments SCHDL";

        var subsi_OW = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(scriptContext) {
            try {
                // trae el parametro de WHT on Payments SCHDL
                var scriptObj = runtime.getCurrentScript();
                // LATAM - WHT VENDOR CREDIT
                var cform_id = scriptObj.getParameter({name: 'custscript_lmry_wht_vendor_credit'});
                var param_id = scriptObj.getParameter({name: 'custscript_lmry_wht_payments_param01'});
                var users_id = scriptObj.getParameter({name: 'custscript_lmry_wht_payments_param02'});

                log.error('Inicio param_id , users_id, cform_id', param_id + ' , ' + users_id + ' , ' + cform_id);

                //cambiar el estado al registro payments log
                var id = record.submitFields({type: 'customrecord_lmry_wht_payments_log',id: param_id,
                    values: {custrecord_lmry_wht_sta: 'procesando',custrecord_lmry_wht_emp:users_id},
                    options: {enableSourcing: false,ignoreMandatoryFields: true,disableTriggers:true}
                });

                //Se procesa el lotes de facturas seleccionadas
                var estado_log = search.lookupFields({
                    type: 'customrecord_lmry_wht_payments_log',
                    id: param_id,
                    columns: ['custrecord_lmry_wht_sub', 'custrecord_lmry_wht_ven', 'custrecord_lmry_wht_bil', 'custrecord_lmry_wht_acc', 'custrecord_lmry_wht_cur', 'custrecord_lmry_wht_ban',
                        'custrecord_lmry_wht_per', 'custrecord_lmry_wht_exc', 'custrecord_lmry_wht_che', 'custrecord_lmry_wht_mem', 'custrecord_lmry_wht_dep','custrecord_lmry_wht_doc',
                        'custrecord_lmry_wht_loc', 'custrecord_lmry_wht_cla', 'custrecord_lmry_wht_met', 'custrecord_lmry_wht_dat','custrecord_lmry_wht_ret','custrecord_lmry_wht_eft',
                        'custrecord_lmry_wht_edi','custrecord_lmry_wht_mul','custrecord_lmry_wht_man','custrecord_lmry_wht_sub.country'
                    ]
                });

                var exchange_actual = estado_log.custrecord_lmry_wht_exc;
                var multib = estado_log.custrecord_lmry_wht_mul;
                var subsidiary = estado_log.custrecord_lmry_wht_sub[0].value;
                var currency_actual_text = estado_log.custrecord_lmry_wht_cur[0].text;
                var docfiscales = estado_log.custrecord_lmry_wht_doc;
                var date = estado_log.custrecord_lmry_wht_dat;
                date = format.format({value:date,type:format.Type.DATE});

                var country = estado_log['custrecord_lmry_wht_sub.country'][0].text;
                country = (country.toUpperCase()).substring(0,3);

                //CONFIGURACION SETUPTAX, ARREGLO DOCFISCAL, ARREGLOBILL
                var arregloSetupTax = library_wht.llenado_setuptax(subsidiary,docfiscales);
                var arregloCurrencies = library_wht.multibooking(currency_actual_text,exchange_actual,multib);

                var accountingPeriod = estado_log.custrecord_lmry_wht_per[0].value;
                var vendor = estado_log.custrecord_lmry_wht_ven[0].value;
                var eft = estado_log.custrecord_lmry_wht_eft;

                var location = '', department = '', clase = '';
                if(estado_log.custrecord_lmry_wht_loc.length != 0){
                  location = estado_log.custrecord_lmry_wht_loc[0].value;
                }
                if(estado_log.custrecord_lmry_wht_dep.length != 0){
                  department = estado_log.custrecord_lmry_wht_dep[0].value;
                }
                if(estado_log.custrecord_lmry_wht_cla.length != 0){
                  clase = estado_log.custrecord_lmry_wht_cla[0].value;
                }

                var noretention = estado_log.custrecord_lmry_wht_ret;
                var manual = estado_log.custrecord_lmry_wht_man;
                var paymentMethod = estado_log.custrecord_lmry_wht_met[0].value;
                var moneda = estado_log.custrecord_lmry_wht_cur[0].value;
                var memo = estado_log.custrecord_lmry_wht_mem;
                var ap = estado_log.custrecord_lmry_wht_acc[0].value;
                var bank = estado_log.custrecord_lmry_wht_ban[0].value;
                var check = estado_log.custrecord_lmry_wht_che;

                library_wht.payment_log('1',param_id, accountingPeriod, vendor, date, arregloCurrencies, arregloSetupTax[0], subsidiary, arregloSetupTax[1], arregloSetupTax[2], arregloCurrencies[2],noretention,manual);
                library_wht.creadoTransacciones(param_id,arregloSetupTax[0],subsidiary,date,accountingPeriod,paymentMethod,moneda,memo,ap,bank,department,clase,location,exchange_actual,multib,cform_id,country,vendor,arregloCurrencies[3],arregloCurrencies[2],eft,check,'0');

                record.submitFields({type:'customrecord_lmry_wht_payments_log',id:param_id,values:{custrecord_lmry_wht_sta:'Finalizado'},option:{disableTriggers:true}});

                var remainingUsage1 = runtime.getCurrentScript().getRemainingUsage();
                log.error('Memoria consumida', remainingUsage1);

            } catch (msgerr) {
              var id = record.submitFields({type: 'customrecord_lmry_wht_payments_log',id: param_id,
                  values: {custrecord_lmry_wht_sta: 'Ocurrio un error, revise su configuracion'},
                  options: {enableSourcing: false,ignoreMandatoryFields: true,disableTriggers:true}});

              library.sendemail(' [ onRequest ] ' + msgerr, LMRY_script);
              log.error('msgerr', msgerr);
            }
        }

        return {
            execute: execute
        };
    });
