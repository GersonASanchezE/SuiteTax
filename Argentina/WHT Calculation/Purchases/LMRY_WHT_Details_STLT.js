/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_WHT_Details_STLT.js                         ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Set 22 2017  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/format', 'N/runtime', 'N/redirect', 'N/task', 'N/email', 'N/config',
        './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0','./WTH_Library/LMRY_WHT_Massive_Payments_LBRY'],

    function(log, serverWidget, record, search, format, runtime, redirect, task, email,config,library,library_wht) {

        var LMRY_script = "LatamReady - WHT DETAILS STLT";
        var Language = runtime.getCurrentScript().getParameter({name: 'LANGUAGE'});
        Language = Language.substring(0, 2);

        //Traducción de Campos
        switch (Language) {
          case 'es':
            var LblForm = 'LatamReady - WHT Detalle';
            var LblPayee = 'Proveedor';
            var LblMsg1 = 'Nota: Está realizando una entrada no válida';
            var LblMsg2 = 'No se puede procesar porque hay un proceso pendiente en la cola';
            var LblMsg3 = 'Importante: no se permite el acceso y / o se ha producido un error';
            var LblGroup1 = 'Información Primaria';
            var LblTittleMsg = 'Mensaje';
            var LblEntDate = 'Fecha Ingresada';
            var LblState = 'Estado';
            var LblIDUser = 'ID Usuario';
            var LblSub = 'Subsidiaria';
            var LblCur = 'Moneda';
            var LblIDProcess = 'ID Proceso';
            var LblSublist = 'Sublista';
            var BtnBack = 'Atrás';
            var BtnSave = 'Guardar';
            break;

          case 'pt':
            var LblForm = 'LatamReady - WHT Detalhes';
            var LblPayee = 'Beneficiário';
            var LblMsg1 = 'Nota: Você está fazendo uma entrada inválida';
            var LblMsg2 = 'Não pode ser processado porque existe um processo pendente na fila';
            var LblMsg3 = 'Importante: o acesso não é permitido e / ou ocorreu um erro';
            var LblGroup1 = 'Informação Primária';
            var LblTittleMsg = 'Mensagem';
            var LblEntDate = 'Data Inserida';
            var LblState = 'Estado';
            var LblIDUser = 'ID do usuário';
            var LblSub = 'Subsidiária';
            var LblCur = 'Moeda';
            var LblIDProcess = 'ID do processo';
            var LblSublist = 'Sublista';
            var BtnBack = 'Voltar';
            var BtnSave = 'Salve';
            break;

          default:
            var LblForm = 'LatamReady - WHT Details';
            var LblPayee = 'Payee';
            var LblMsg1 = 'Note: You are making an invalid entry';
            var LblMsg2 = 'Can not be processed as there is a pending process in the queue';
            var LblMsg3 = 'Important: Access is not allowed and / or an error has occurred';
            var LblGroup1 = 'Primary Information';
            var LblTittleMsg = 'Message';
            var LblEntDate = 'Entered Date';
            var LblState = 'State';
            var LblIDUser = 'User ID';
            var LblSub = 'Subsidiary';
            var LblCur = 'Currency';
            var LblIDProcess = 'Process ID';
            var LblSublist = 'Sublist';
            var BtnBack = 'Back';
            var BtnSave = 'Save';
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

                // Inicio del SuiteLet
                if (context.request.method == 'GET') {
                    /**************************************************************
                     * Valida que el SuiteLet se este llamando de forma correcta.
                     *********************************************************** */
                    var _estado = context.request.parameters.param_logid;
                    var _userid = context.request.parameters.param_useid;

                    if (_estado == '' || _estado == null) {
                        // Nombre del formulario

                        var formu = serverWidget.createForm({title: LblForm});

                        var strhtml = "<html>";
                        strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
                        strhtml += "<tr>";
                        strhtml += "</tr>";
                        strhtml += "<tr>";
                        strhtml += "<td class='text'>";
                        strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">";
                        strhtml += LblMsg1 +". </div>";
                        strhtml += "</td>";
                        strhtml += "</tr>";
                        strhtml += "</table>";
                        strhtml += "</html>";

                        var myInlineHtml = formu.addField({id: 'custpage_id_message',label: LblTittleMsg ,type: serverWidget.FieldType.INLINEHTML});
                        myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
                        myInlineHtml.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});
                        myInlineHtml.defaultValue = strhtml;

                        // Dibuja el Formulario
                        context.response.writePage(formu);
                        return true;
                    }
                    // Parametros del SuiteLet
                    log.error('Bill onRequest: _estado, _userid', _estado + ' , ' + _userid);

                    /**************************************************************
                     * Empieza el proceso de calculo de Retenciones segun la
                     * configuracion del Contribution Class de Proveedor.
                     *********************************************************** */
                    // Se procesa el lotes de facturas seleccionadas
                    //Estado es el id de ese record creado en el client, uno por proceso, recupera vendor y facturas con montos
                    var estado_log = search.lookupFields({type: 'customrecord_lmry_wht_payments_log',id: _estado,
                        columns: ['custrecord_lmry_wht_ven', 'custrecord_lmry_wht_bil', 'custrecord_lmry_wht_per', 'custrecord_lmry_wht_dat',
                        'custrecord_lmry_wht_exc','custrecord_lmry_wht_cur','custrecord_lmry_wht_sub','custrecord_lmry_wht_doc','custrecord_lmry_wht_mul']
                    });

                    var subsidiary = estado_log.custrecord_lmry_wht_sub[0].value;
                    var docfiscales = estado_log.custrecord_lmry_wht_doc;
                    var vendor = estado_log.custrecord_lmry_wht_ven[0].value;
                    var date = estado_log.custrecord_lmry_wht_dat;
                    var accounting_period = estado_log.custrecord_lmry_wht_per[0].value;
                    var doc_fiscales = estado_log.custrecord_lmry_wht_doc;

                    var exchange_actual = estado_log.custrecord_lmry_wht_exc;
                    var currency_actual = estado_log.custrecord_lmry_wht_cur[0].value;
                    var currency_actual_text = estado_log.custrecord_lmry_wht_cur[0].text;

                    var multib = estado_log.custrecord_lmry_wht_mul;

                    // SETUPTAX
                    var arreglo_setuptax = library_wht.llenado_setuptax(subsidiary,docfiscales);
                    log.error('[ arreglo_setuptax ]', arreglo_setuptax);
                    //MULTIBOOKING
                    var arreglo_currencies = library_wht.multibooking(currency_actual_text,exchange_actual,multib);
                    log.error('[ arreglo_currencies ]', arreglo_currencies);

                    library_wht.payment_log('0',_estado,accounting_period,vendor, date, arreglo_currencies, arreglo_setuptax[0], subsidiary, arreglo_setuptax[1], arreglo_setuptax[2],arreglo_currencies[2]);

                    var arregloBanderas = library_wht.banderas();
                    log.error('[ arregloBanderas ]', arregloBanderas);

                    /*********************************CONSULTA EL PREVIEW DE LAS NOTAS DE CREDITO **************************/
                    // DIBUJAR FORM
                    var form = serverWidget.createForm({title: LblForm});
                    form.addFieldGroup({id: 'grup_pi',label: LblGroup1});

                    var p_subsi = form.addField({id: 'id_subsi', label: LblSub, type: serverWidget.FieldType.SELECT, source: 'subsidiary', container: 'grup_pi'});
                    p_subsi.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    p_subsi.defaultValue = subsidiary;

                    var pi_curr = form.addField({id: 'pi_id_curr',label:  LblCur, type: serverWidget.FieldType.SELECT, source: 'currency', container: 'grup_pi'});
                    pi_curr.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    pi_curr.defaultValue = currency_actual;

                    var pi_vend = form.addField({id: 'pi_id_vend',label: LblPayee,type: serverWidget.FieldType.SELECT,source: 'vendor',container: 'grup_pi'});
                    pi_vend.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    pi_vend.defaultValue = vendor;

                    var pi_date = form.addField({id: 'pi_id_date',label: LblEntDate,type: serverWidget.FieldType.DATE,source: 'date',container: 'grup_pi'});
                    pi_date.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    pi_date.defaultValue = date;

                    form.addFieldGroup({id: 'grup_st',label: LblState});

                    var id_proc = form.addField({id: 'custpage_st_proc',label: LblIDProcess,type: serverWidget.FieldType.TEXT,container: 'grup_st'});
                    id_proc.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    id_proc.defaultValue = _estado;

                    var id_user = form.addField({id: 'st_user',label: LblIDUser,type: serverWidget.FieldType.TEXT,container: 'grup_st'});
                    id_user.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    id_user.defaultValue = _userid;

                    var SubTabla = form.addSublist({id: 'custpage_id_sub',type: serverWidget.SublistType.LIST,label: LblSublist});

                    library_wht.llenadoSubTabla(SubTabla,'0',arregloBanderas,subsidiary, Language);

                    var remainingUsage1 = runtime.getCurrentScript().getRemainingUsage();
                    log.error('Memoria consumida', remainingUsage1);

                    form.addSubmitButton({label: BtnSave});
                    form.addButton({id: 'id_cancel',label: BtnBack,functionName: 'funcionCancel'});

                    // Asigna el script cliente
                    form.clientScriptModulePath = './WTH_Library/lmry_wht_details_cancel2.js';

                    // Dibuja el formulario
                    context.response.writePage(form);

                    // Fin del SuiteLet
                } else {

                    var params = {};
                    //En la derecha estan el id de estado y de user
                    params['custscript_lmry_wht_payments_param01'] = context.request.parameters.custpage_st_proc;
                    params['custscript_lmry_wht_payments_param02'] = context.request.parameters.st_user;

                    try {
                        var redi_sche = task.create({
                            taskType: task.TaskType.SCHEDULED_SCRIPT,
                            scriptId: 'customscript_lmry_wht_payments_schdl',
                            deploymentId: 'customdeploy_lmry_wht_payments_schdl',
                            params: params
                        });
                        redi_sche.submit();

                        redirect.toSuitelet({
                            scriptId: 'customscript_lmry_wht_log_payments_sltl',
                            deploymentId: 'customdeploy_lmry_wht_log_payments_sltl'
                        });

                    } catch (err) {
                        log.error({title: 'Se generó un error en suitelet',details: err});
                        var form = serverWidget.createForm({title: LblForm});

                        var myInlineHtml = form.addField({id: 'custpage_id_message',label: LblTittleMsg,type: serverWidget.FieldType.INLINEHTML});
                        myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
                        myInlineHtml.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});

                        var strhtml = "<html>";
                        strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
                        strhtml += "<tr>";
                        strhtml += "<button style=\"font-size: 14px; font-weight:bold\"><a style=\"text-decoration:none\" href=\"javascript:history.back()\"> Back</a></button>";
                        strhtml += "</tr>";
                        strhtml += "<tr>";
                        strhtml += "<td class='text'>";
                        strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">"+LblMsg2+"</div>";
                        strhtml += "</td>";
                        strhtml += "</tr>";
                        strhtml += "</table>";
                        strhtml += "</html>";

                        myInlineHtml.defaultValue = strhtml;

                        context.response.writePage(form);

                    }
                }
            } catch (err) {
                log.error({title: 'Se generó un error en suitelet',details: err});

                var form = serverWidget.createForm({title: LblForm});
                var myInlineHtml = form.addField({id: 'custpage_id_message',label: LblTittleMsg,type: serverWidget.FieldType.INLINEHTML});

                myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
                myInlineHtml.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});

                var strhtml = "<html>";
                strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
                strhtml += "<tr>";
                strhtml += "</tr>";
                strhtml += "<tr>";
                strhtml += "<td class='text'>";
                strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">"+LblMsg3+".</div>";
                strhtml += "</td>";
                strhtml += "</tr>";
                strhtml += "</table>";
                strhtml += "</html>";

                myInlineHtml.defaultValue = strhtml;

                // Dibuja el Formulario
                context.response.writePage(form);

                // Envio de mail al clientes
                library.sendemail(' [ onRequest ] ' + err, LMRY_script);
            }

        }
        return {
            onRequest: onRequest
        };
    });
