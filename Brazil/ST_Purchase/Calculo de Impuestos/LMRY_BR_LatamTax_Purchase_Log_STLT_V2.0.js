/*= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
  ||  This script for customer center                             ||
  ||                                                              ||
  ||  File Name:  LMRY_BR_LatamTax_Purchase_Log_STLT_V2.0.js      ||
  ||                                                              ||
  ||  Version Date         Author        Remarks                  ||
  ||  2.0     Oct 03 2019  LatamReady    Bundle 37714             ||
   \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/log', 'N/search', 'N/runtime', 'N/ui/serverWidget', 'N/url', 'N/redirect', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],

    function (log, search, runtime, serverWidget, url, redirect, library_email) {

        var LMRY_script = 'Latamready - BR Archivo Retorno Log STLT';

        var labels = {
            'Nota1': {
                'en': 'Note: Transactions are being processed. ',
                'es': 'Nota: Se esta procesando las transacciones. ',
                'pt': 'Nota: as transações estão sendo processadas. '
            },
            'Nota2': {
                'en': 'The [STATUS] column indicates the status of the process.<br><br>',
                'es': 'La columna [ESTADO] indica el estado del proceso.<br><br>',
                'pt': 'A coluna [ESTADO] indica o status do processo.<br><br>'
            },
            'Nota3': {
                'en': 'Press the Refresh button to see if the process finished.</div>',
                'es': 'Presionar el botón actualizar para ver si el proceso terminó.</div>',
                'pt': 'Pressione o botão atualizar para ver se o processo foi concluído.</div>'
            },
            'lblSublist': {
                'en': 'Results',
                'es': 'Resultados',
                'pt': 'Resultados'
            },
            'sublbl1': {
                'en': 'INTERNAL ID',
                'es': 'ID INTERNO',
                'pt': 'ID INTERNO'
            },
            'sublbl2': {
                'en': 'USER',
                'es': 'USUARIO',
                'pt': 'USUÀRIO'
            },
            'sublbl3': {
                'en': 'SUBSIDIARY',
                'es': 'SUBSIDIARIA',
                'pt': 'SUBSIDIÁRIA'
            },
            'sublbl4': {
                'en': 'PERIOD',
                'es': 'PERÍODO',
                'pt': 'PERÍODO'
            },
            'sublbl5': {
                'en': 'CURRENCY',
                'es': 'MONEDA',
                'pt': 'MOEDA'
            },
            'sublbl6': {
                'en': 'EXECUTION TYPE',
                'es': 'TIPO DE EJECUCIÓN',
                'pt': 'TIPO DE EXECUÇÃO'
            },
            'sublbl7': {
                'en': 'TRANSACTION',
                'es': 'TRANSACCIÓN',
                'pt': 'TRANSAÇÃO'
            },
            'sublbl8': {
                'en': 'DATE CREATED',
                'es': 'FECHA DE CREACIÓN',
                'pt': 'DATA DE CRIAÇÃO'
            },
            'sublbl9': {
                'en': 'STATUS',
                'es': 'ESTADO',
                'pt': 'ESTADO'
            },
            'btnlbl': {
                'en': 'Filter',
                'es': 'Filtrar',
                'pt': 'Filtrar'
            },
            'btnback': {
                'en': 'Back',
                'es': 'Atrás',
                'pt': 'Atrás'
            }
        }

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {

            try {

                if (context.request.method == 'GET') {
                    var form = serverWidget.createForm({ title: 'LatamTAX Purchase Log' });

                    var Language = runtime.getCurrentScript().getParameter({
                        name: 'LANGUAGE'
                    });
                    Language = Language.substring(0, 2);

                    
                    var Rdexetype = context.request.parameters.exetypeopc;

                    var lblexetype = labels['sublbl6'][Language] ? labels['sublbl6'][Language] : labels['sublbl6']['en'];
                    var ExeTypeField = form.addField({ id: 'custpage_id_exetype', label: lblexetype, type: serverWidget.FieldType.SELECT });
                    ExeTypeField.addSelectOption({
                        value: 1,
                        text: 'Manual'
                    });
                    ExeTypeField.addSelectOption({
                        value: 2,
                        text: 'Automatic'
                    });
                    ExeTypeField.addSelectOption({
                        value: 3,
                        text: 'All (Manual and Automatic)'
                    });

                    if (Rdexetype != null && Rdexetype != '') {
                        ExeTypeField.defaultValue = Rdexetype;
                    }

                    var myInlineHtml = form.addField({ id: 'custpage_id_message', label: 'MESSAGE', type: serverWidget.FieldType.INLINEHTML });
                    myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
                    myInlineHtml.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTCOL });

                    var lbl1 = labels['Nota1'][Language] ? labels['Nota1'][Language] : labels['Nota1']['en'];
                    var lbl2 = labels['Nota2'][Language] ? labels['Nota2'][Language] : labels['Nota2']['en'];
                    var lbl3 = labels['Nota3'][Language] ? labels['Nota3'][Language] : labels['Nota3']['en'];

                    var strhtml = "<html>";
                    strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
                    strhtml += "<tr>";
                    strhtml += "</tr>";
                    strhtml += "<tr>";
                    strhtml += "<td class='text'>";
                    strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">";
                    strhtml += lbl1;
                    strhtml += lbl2;
                    strhtml += lbl3;
                    strhtml += "</td>";
                    strhtml += "</tr>";
                    strhtml += "</table>";
                    strhtml += "</html>";

                    myInlineHtml.defaultValue = strhtml;

                    

                    var lblSublist = labels['lblSublist'][Language] ? labels['lblSublist'][Language] : labels['lblSublist']['en'];

                    var sublista = form.addSublist({ id: 'id_sublist', label: lblSublist, type: serverWidget.SublistType.STATICLIST });

                    sublista.addRefreshButton();

                    var sublbl1 = labels['sublbl1'][Language] ? labels['sublbl1'][Language] : labels['sublbl1']['en'];
                    var sublbl2 = labels['sublbl2'][Language] ? labels['sublbl2'][Language] : labels['sublbl2']['en'];
                    var sublbl3 = labels['sublbl3'][Language] ? labels['sublbl3'][Language] : labels['sublbl3']['en'];
                    var sublbl4 = labels['sublbl4'][Language] ? labels['sublbl4'][Language] : labels['sublbl4']['en'];
                    var sublbl5 = labels['sublbl5'][Language] ? labels['sublbl5'][Language] : labels['sublbl5']['en'];
                    var sublbl6 = labels['sublbl6'][Language] ? labels['sublbl6'][Language] : labels['sublbl6']['en'];
                    var sublbl7 = labels['sublbl7'][Language] ? labels['sublbl7'][Language] : labels['sublbl7']['en'];
                    var sublbl8 = labels['sublbl8'][Language] ? labels['sublbl8'][Language] : labels['sublbl8']['en'];
                    var sublbl9 = labels['sublbl9'][Language] ? labels['sublbl9'][Language] : labels['sublbl9']['en'];

                    sublista.addField({ id: 'id_internalid', type: serverWidget.FieldType.TEXT, label: sublbl1 });
                    sublista.addField({ id: 'id_user', type: serverWidget.FieldType.TEXT, label: sublbl2 });
                    sublista.addField({ id: 'id_subsidiary', type: serverWidget.FieldType.TEXT, label: sublbl3 });
                    sublista.addField({ id: 'id_period', type: serverWidget.FieldType.TEXT, label: sublbl4 });
                    sublista.addField({ id: 'id_currency', type: serverWidget.FieldType.TEXT, label: sublbl5 });
                    sublista.addField({ id: 'id_exectype', type: serverWidget.FieldType.TEXT, label: sublbl6 });
                    sublista.addField({ id: 'id_transaction', type: serverWidget.FieldType.TEXTAREA, label: sublbl7 });
                    sublista.addField({ id: 'id_datecreated', type: serverWidget.FieldType.TEXT, label: sublbl8 });
                    sublista.addField({ id: 'id_status', type: serverWidget.FieldType.TEXT, label: sublbl9 });

                    var search_log = search.create({
                        type: 'customrecord_lmry_br_latamtax_pur_log',
                        columns: [
                            search.createColumn({ name: "internalid", sort: search.Sort.DESC }),
                            'custrecord_lmry_br_pur_log_user',
                            'custrecord_lmry_br_pur_log_subsidiary',
                            'custrecord_lmry_br_pur_log_period',
                            'custrecord_lmry_br_pur_log_currency',
                            'custrecord_lmry_br_pur_log_execute_type',
                            'custrecord_lmry_br_pur_log_transactions',
                            'created',
                            'custrecord_lmry_br_pur_log_status'
                        ],
                        filters: [
                            ['isinactive', 'is', 'F']
                        ]
                    });

                    if (Rdexetype != null && Rdexetype != '') {
                        if (Rdexetype == '1') {
                            search_log.filters.push(search.createFilter({
                                name: 'custrecord_lmry_br_pur_log_execute_type',
                                operator: 'is',
                                values: 'Manual'
                            }));
                        }
                        if (Rdexetype == '2') {
                            search_log.filters.push(search.createFilter({
                                name: 'custrecord_lmry_br_pur_log_execute_type',
                                operator: 'is',
                                values: 'Automatic'
                            }));
                        }
                    }

                    var result_log = search_log.run().getRange({ start: 0, end: 1000 });

                    if (result_log != null && result_log.length > 0) {

                        for (var i = 0; i < result_log.length; i++) {

                            var id = "" + result_log[i].getValue('internalid');
                            if (id != '') {
                                sublista.setSublistValue({ id: 'id_internalid', line: i, value: id });
                            }

                            var user = "" + result_log[i].getText('custrecord_lmry_br_pur_log_user');
                            if (user != '') {
                                sublista.setSublistValue({ id: 'id_user', line: i, value: user });
                            }

                            var subsidiary = '' + result_log[i].getText('custrecord_lmry_br_pur_log_subsidiary');
                            if (subsidiary != '') {
                                sublista.setSublistValue({ id: 'id_subsidiary', line: i, value: subsidiary });
                            }

                            var period = '' + result_log[i].getText('custrecord_lmry_br_pur_log_period');
                            if (period != '') {
                                sublista.setSublistValue({ id: 'id_period', line: i, value: period });
                            }

                            var currency = '' + result_log[i].getText('custrecord_lmry_br_pur_log_currency');
                            if (currency != '') {
                                sublista.setSublistValue({ id: 'id_currency', line: i, value: currency });
                            }

                            var exectype = '' + result_log[i].getValue('custrecord_lmry_br_pur_log_execute_type');
                            if (exectype != '') {
                                sublista.setSublistValue({ id: 'id_exectype', line: i, value: exectype });
                            }

                            var payment = '' + result_log[i].getValue('custrecord_lmry_br_pur_log_transactions');
                            if (payment != '') {
                                if (payment.indexOf("|") > -1) {
                                    var url_detalle = url.resolveRecord({
                                        recordType: 'customrecord_lmry_br_latamtax_pur_log',
                                        recordId: id
                                    });
                                    sublista.setSublistValue({ id: 'id_transaction', line: i, value: '<a href="' + url_detalle + '" target="_blank">' + 'Ver Transacciones' + '</a>' });
                                } else {
                                    var url_detalle = '/app/accounting/transactions/transaction.nl?id=' + payment;
                                    sublista.setSublistValue({ id: 'id_transaction', line: i, value: '<a href="' + url_detalle + '" target="_blank">' + payment + '</a>' });
                                }
                            }

                            var created = '' + result_log[i].getValue('created');
                            if (created != '') {
                                sublista.setSublistValue({ id: 'id_datecreated', line: i, value: created });
                            }

                            var status = '' + result_log[i].getText('custrecord_lmry_br_pur_log_status');
                            if (status != '') {
                                sublista.setSublistValue({ id: 'id_status', line: i, value: status });
                            }
                        }
                    }

                    var btnlbl = labels['btnlbl'][Language] ? labels['btnlbl'][Language] : labels['btnlbl']['en'];
                    form.addSubmitButton({ label: btnlbl });

                    var btnback = labels['btnback'][Language] ? labels['btnback'][Language] : labels['btnback']['en'];
                    form.addButton({
                        id : 'buttonBackToMain',
                        label : btnback,
                        functionName : 'backToMain()'
                    });
                    form.clientScriptModulePath = './Latam_Library/LMRY_BR_LatamTax_Purchase_Log_CLNT_V2.0.js';

                    context.response.writePage(form);

                } else {
                    var exetype = context.request.parameters.custpage_id_exetype;

                    redirect.toSuitelet({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId,
                        parameters: {
                            'exetypeopc': exetype
                        }
                    });
                }

            } catch (error) {
                library_email.sendemail('[ onRequest ]' + error, LMRY_script);
                log.error('[onRequest]', error);
            }
            
            return true;
        }

        return {
            onRequest: onRequest
        };

    });