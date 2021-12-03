/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_LatamTax_Purchase_CLNT_V2.0.js           ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Feb 05 2020  LatamReady    Bundle 37714             ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 */

define(['N/search', 'N/runtime', 'N/currentRecord', 'N/url', 'N/ui/message'],

    function (search, runtime, currentRecord, url, message) {

        var subsi_OW;
        var LMRY_script = 'LatamReady - BR LatamTax Purchase CLNT';
        var LANGUAGE = runtime.getCurrentScript().getParameter({ name: 'LANGUAGE' });
        LANGUAGE = LANGUAGE.substring(0, 2);

        //Mensajes de alerta
        switch (LANGUAGE) {
            case 'es':
                //Mensajes de alerta
                var Mensaje1 = 'Debe tener configurado el campo "Latam - Multicurrency" para el record "LatamReady - Setup Tax Subsidiary" para poder continuar';
                var Mensaje2 = 'Ingresar Subsidiaria';
                var Mensaje3 = 'Ingresar Moneda';
                var Mensaje4 = 'Ingresar Período';
                var Mensaje5 = 'No se ha seleccionado ninguna transacción';
                break;

            case 'pt':
                //Mensajes de alerta
                var Mensaje1 = 'Debe tener configurado el campo "Latam - Multicurrency" para el record "LatamReady - Setup Tax Subsidiary" para poder continuar';
                var Mensaje2 = 'Ingresar Subsidiaria';
                var Mensaje3 = 'Ingresar Moneda';
                var Mensaje4 = 'Ingresar Período';
                var Mensaje5 = 'No se ha seleccionado ninguna transacción';
                break;

            default:
                //Mensajes de alerta
                var Mensaje1 = 'You must have the "Latam - Multicurrency" field configured for the "LatamReady - Setup Tax Subsidiary" record in order to continue';
                var Mensaje2 = 'Enter Subsidiary';
                var Mensaje3 = 'Enter Currency';
                var Mensaje4 = 'Enter Period';
                var Mensaje5 = 'No transaction has been selected';
        }

        function validateField(scriptContext) {
            try {
                var objRecord = scriptContext.currentRecord;
                var field = scriptContext.fieldId;
                console.log('field: ' + field);

                if (field == 'custpage_id_subsi') {

                    var hasSetup = false;
                    var subsidiaria = objRecord.getValue({ fieldId: 'custpage_id_subsi' });

                    var field_currency = objRecord.getField({ fieldId: 'custpage_id_currency' });
                    field_currency.removeSelectOption({ value: null });
                    console.log('subsidiaria: ' + subsidiaria);

                    if (subsidiaria != '' && subsidiaria != null && subsidiaria != 0) {

                        var search_setuptax = search.create({
                            type: 'customrecord_lmry_setup_tax_subsidiary',
                            filters: [
                                { name: 'custrecord_lmry_setuptax_subsidiary', operator: 'is', values: subsidiaria },
                                { name: 'isinactive', operator: 'is', values: 'F' }
                            ],
                            columns: ['custrecord_lmry_setuptax_multicurrency']
                        });

                        var result_setuptax = search_setuptax.run().getRange(0, 1);
                        console.log('result_setuptax: ' + result_setuptax);

                        if (result_setuptax != null && result_setuptax.length > 0) {

                            field_currency.insertSelectOption({ value: 0, text: ' ' });

                            console.log('multicurrency: ' + result_setuptax[0].getValue('custrecord_lmry_setuptax_multicurrency'));
                            if (result_setuptax[0].getValue('custrecord_lmry_setuptax_multicurrency') != null && result_setuptax[0].getValue('custrecord_lmry_setuptax_multicurrency') != '') {
                                var currency_value = result_setuptax[0].getValue('custrecord_lmry_setuptax_multicurrency').split(',');
                                //var currency_text = result_setuptax[0].getText('custrecord_lmry_setuptax_multicurrency').split(',');

                                for (var i = 0; i < currency_value.length; i++) {
                                    var c_text = search.lookupFields({ type: search.Type.CURRENCY, id: currency_value[i], columns: ['name'] });
                                    c_text = c_text.name;
                                    field_currency.insertSelectOption({ value: currency_value[i], text: c_text });
                                }
                                hasSetup = true;
                            }

                        }
                        if (!hasSetup) {
                            alert(Mensaje1);
                            return false;
                        }
                    }
                }

            } catch (err) {
                alert(LMRY_script + ' [validateField] ' + err);
                return false;
            }
            return true;
        }

        function saveRecord(scriptContext) {
            try {
                var objRecord = scriptContext.currentRecord;
                var estado = objRecord.getValue({ fieldId: 'custpage_id_state' });
                if (estado == 'F' || estado == false) {
                    var _subsi = objRecord.getValue({ fieldId: 'custpage_id_subsi' });
                    var _curre = objRecord.getValue({ fieldId: 'custpage_id_currency' });
                    var _perio = objRecord.getValue({ fieldId: 'custpage_id_period' });

                    if (_subsi == '' || _subsi == null || _subsi == 0) {
                        alert(Mensaje2);
                        return false;
                    }
                    if (_curre == '' || _curre == null || _curre == 0) {
                        alert(Mensaje3);
                        return false;
                    }
                    if (_perio == '' || _perio == null || _perio == 0) {
                        alert(Mensaje4);
                        return false;
                    }


                } else {
                    var cantidadLineas = objRecord.getLineCount({ sublistId: 'custpage_id_sublista' });
                    var cantidadAplicada = 0;

                    for (var i = 0; i < cantidadLineas; i++) {
                        var aplica = objRecord.getSublistValue({ sublistId: 'custpage_id_sublista', fieldId: 'id_appl', line: i });
                        if (aplica == true || aplica == 'T') {
                            cantidadAplicada++;
                        }
                    }
                    if (cantidadAplicada == 0) {
                        alert(Mensaje5);
                        return false;
                    }

                    //Validacion de proceso automatico
                    if (!checkExecutionByScript("customscript_lmry_br_latamtax_schd_mprd", "customdeploy_lmry_br_latamtax_schd_mprd") ||
                        !checkExecutionByScript("customscript_lmry_br_latamtax_pur_mprd", "customdeploy_lmry_br_latamtax_pur_mprd")) {
                        var urlSuitelet = url.resolveScript({
                            scriptId: 'customscript_lmry_br_latamtax_pur_stlt',
                            deploymentId: 'customdeploy_lmry_br_latamtax_pur_stlt',
                            returnExternalUrl: false
                        });
                        setTimeout(function () {
                            setWindowChanged(window, false);
                            window.location.href = urlSuitelet;
                        }, 2000);
                        return false;
                    }
                }

            } catch (err) {
                alert(LMRY_script + ' [saveRecord] ' + err);
                return false;
            }
            return true;
        }

        function redirectBack() {
            try {
                var url_red = url.resolveScript({
                    scriptId: 'customscript_lmry_br_latamtax_pur_stlt',
                    deploymentId: 'customdeploy_lmry_br_latamtax_pur_stlt',
                    returnExternalUrl: false
                });
                setWindowChanged(window, false);
                window.location.href = url_red;
            } catch (err) {
                alert(LMRY_script + ' [redirectBack] ' + err);
                return false;
            }
        }

        function redirectBackBC() {
            try {
                var url_red = url.resolveScript({
                    scriptId: 'customscript_lmry_br_latamtax_bc_stlt',
                    deploymentId: 'customdeploy_lmry_br_latamtax_bc_stlt',
                    returnExternalUrl: false
                });
                setWindowChanged(window, false);
                window.location.href = url_red;
            } catch (err) {
                alert(LMRY_script + ' [redirectBackBC] ' + err);
                return false;
            }
        }

        function checkExecutionByScript(scriptId, scriptDeploymentId) {
            var isValid = true;
            var search_executions = search.create({
                type: "scheduledscriptinstance",
                filters:
                    [
                        ["script.scriptid", "startswith", scriptId], "AND",
                        ["scriptdeployment.scriptid", "startswith", scriptDeploymentId], "AND",
                        ["status", "anyof", "PENDING", "PROCESSING"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "timestampcreated",
                            sort: search.Sort.DESC
                        }),
                        "mapreducestage",
                        "status",
                        "taskid"
                    ]
            });

            var results = search_executions.run().getRange(0, 1);

            var alertMsg = {
                'title': {
                    'es': 'Alerta', 'pt': 'Alerta', 'en': 'Alert'
                },
                'description': {
                    'es': 'Espere un momento por favor, se encuentra en transcurso un Proceso de LatamTax Compras.',
                    'pt': 'Aguarde um momento, um processo de LatamTax Compras.',
                    'en': 'Please wait a moment, a LatamTax Purchase process is in progress.'
                }
            };

            if (results && results.length) {
                isValid = false;
                var myMsg = message.create({
                    title: alertMsg["title"][LANGUAGE] || alertMsg["title"]['en'],
                    message: alertMsg["description"][LANGUAGE] || alertMsg["description"]["en"],
                    type: message.Type.INFORMATION,
                    duration: 2000
                });
                myMsg.show();
            }

            return isValid;
        }

        return {
            //pageInit: pageInit,
            validateField: validateField,
            saveRecord: saveRecord,
            redirectBack: redirectBack,
            redirectBackBC: redirectBackBC
        };

    });