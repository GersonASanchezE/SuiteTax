/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_New_LatamTax_Details_STLT.js  				      ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Oct 27 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/record','N/search','N/log','N/ui/serverWidget','N/runtime','N/redirect','N/url','N/task','N/format',
        './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0','./WTH_Library/LMRY_New_LatamTax_Sales_LBRY'],

function(record, search, log, serverWidget, runtime, redirect, url, task, format, libraryEmail, librarySales) {

    var LMRY_script = 'LatamReady - New LatamTax Details STLT';
    var Language = runtime.getCurrentScript().getParameter({name: 'LANGUAGE'});
    Language = Language.substring(0, 2);

    function onRequest(context) {

      try{

          switch (Language) {
            case 'es':
              var LblForm = 'LatamReady - Nuevo LatamTax Ventas Detalles';
              var LblMsg1 = 'Nota: Está realizando una entrada no válida';
              var LblMsg2 = 'No se puede procesar porque hay un proceso pendiente en la cola';
              var LblMsg3 = 'Importante: no se permite el acceso y / o se ha producido un error';
              var LblGroup1 = 'Información Primaria';
              var LblTittleMsg = 'Mensaje';
              var LblEntDate = 'Fecha de Ingreso';
              var LblState = 'Estado';
              var LblIDUser = 'ID Usuario';
              var LblSub = 'Subsidiaria';
              var LblCur = 'Moneda';
              var LblIDProcess = 'ID Proceso';
              var LblSublist = 'Sublista';
              var BtnBack = 'Cancelar';
              var BtnSave = 'Generar';
              var LblCust = 'Cliente';
              break;

            case 'pt':
              var LblForm = 'LatamReady - Novos LatamTax Vendas Detalhes';
              var LblMsg1 = 'Nota: Você está fazendo uma entrada inválida';
              var LblMsg2 = 'Não pode ser processado porque existe um processo pendente na fila';
              var LblMsg3 = 'Importante: o acesso não é permitido e / ou ocorreu um erro';
              var LblGroup1 = 'Informação Primária';
              var LblTittleMsg = 'Mensagem';
              var LblEntDate = 'Data Inserida';
              var LblState = 'Estado';
              var LblIDUser = 'ID do Usuário';
              var LblSub = 'Subsidiária';
              var LblCur = 'Moeda';
              var LblIDProcess = 'ID do Processo';
              var LblSublist = 'Sublista';
              var BtnBack = 'Cancelar';
              var BtnSave = 'Gerar';
              var LblCust = 'Cliente';
              break;

            default:
              var LblForm = 'LatamReady - New LatamTax Sales Details';
              var LblMsg1 = 'Note: You are making an invalid entry';
              var LblMsg2 = 'Can not be processed as there is a pending process in the queue';
              var LblMsg3 = 'Important: Access is not allowed and / or an error has occurred';
              var LblGroup1 = 'Primary Information';
              var LblTittleMsg = 'Message';
              var LblEntDate = 'Entered date';
              var LblState = 'State';
              var LblIDUser = 'User ID';
              var LblSub = 'Subsidiary';
              var LblCur = 'Currency';
              var LblIDProcess = 'Process ID';
              var LblSublist = 'Sublist';
              var BtnBack = 'Cancel';
              var BtnSave = 'Generate';
              var LblCust = 'Customer';
          }

          if(context.request.method == 'GET'){
            var form = serverWidget.createForm({title: LblForm});

            var state = context.request.parameters.param_logid;
            var useid = context.request.parameters.param_useid;

            var searchLog = search.lookupFields({type: 'customrecord_lmry_new_latamtax_sales_log', id: state,
            columns: ['custrecord_lmry_new_latamtax_subsidiary','custrecord_lmry_new_latamtax_customer','custrecord_lmry_new_latamtax_currency','custrecord_lmry_new_latamtax_date',
            'custrecord_lmry_new_latamtax_multibook','custrecord_lmry_new_latamtax_rate','custrecord_lmry_new_latamtax_period','custrecord_lmry_new_latamtax_invoices',
            'custrecord_lmry_new_latamtax_method','custrecord_lmry_new_latamtax_araccount','custrecord_lmry_new_latamtax_bank','custrecord_lmry_new_latamtax_memo',
            'custrecord_lmry_new_latamtax_department','custrecord_lmry_new_latamtax_class','custrecord_lmry_new_latamtax_location','custrecord_lmry_new_latamtax_check']});

            //FUNCIONES GLOBALES: CONFIGURACION
            librarySales.setupTaxSubsidiary(searchLog.custrecord_lmry_new_latamtax_subsidiary[0].value);
            librarySales.multibooking(searchLog.custrecord_lmry_new_latamtax_currency[0].value, searchLog.custrecord_lmry_new_latamtax_multibook, searchLog.custrecord_lmry_new_latamtax_rate);

            //FUNCIONES GLOBALES: CALCULOS
            librarySales.getAccumulated(searchLog.custrecord_lmry_new_latamtax_customer[0].value, 0, searchLog.custrecord_lmry_new_latamtax_period[0].value, searchLog.custrecord_lmry_new_latamtax_subsidiary[0].value, searchLog.custrecord_lmry_new_latamtax_date);
            librarySales.ccynt(searchLog.custrecord_lmry_new_latamtax_customer[0].value, searchLog.custrecord_lmry_new_latamtax_date, searchLog.custrecord_lmry_new_latamtax_subsidiary[0].value);

            var invoices = [];
            var auxInvoice = JSON.parse(searchLog.custrecord_lmry_new_latamtax_invoices);
            for(var i in auxInvoice){
              invoices.push(i);
            }

            librarySales.basesAllInvoice(invoices);

            //FUNCIONES X ITERACION
            librarySales.getSalesLog(searchLog, 0); //CUANDO SE HAGA EL MASIVO, CAMBIAR ESTA FUNCION
            librarySales.creditMemo(searchLog.custrecord_lmry_new_latamtax_customer[0].value);
            librarySales.retencion(searchLog.custrecord_lmry_new_latamtax_customer[0].value)

            //CABECERA STLT
            form.addFieldGroup({id:'group_pi',label:  LblGroup1});

            var p_subsi = form.addField({id: 'id_subsi', label: LblSub, type: 'select', source: 'subsidiary', container: 'group_pi'});
            p_subsi.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            p_subsi.defaultValue = searchLog.custrecord_lmry_new_latamtax_subsidiary[0].value;;

            var p_curren = form.addField({id: 'id_curren', label: LblCur, type: 'text', container: 'group_pi'});
            p_curren.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            p_curren.defaultValue = searchLog.custrecord_lmry_new_latamtax_currency[0].text;

            var p_customer = form.addField({id: 'id_customer', label: LblCust, type: 'text', container: 'group_pi'});
            p_customer.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            p_customer.defaultValue = searchLog.custrecord_lmry_new_latamtax_customer[0].text;

            var p_date = form.addField({id: 'id_date',label: LblEntDate, type: 'date', source: 'date',container: 'group_pi'});
            p_date.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            p_date.defaultValue = searchLog.custrecord_lmry_new_latamtax_date;

            form.addFieldGroup({id:'group_state',label:LblState});

            var p_proc = form.addField({id: 'custpage_st_proc',label: LblIDProcess,type: serverWidget.FieldType.TEXT,container: 'group_state'});
            p_proc.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            p_proc.defaultValue = state;

            var p_user = form.addField({id: 'id_user',label: LblIDUser,type: serverWidget.FieldType.TEXT,container: 'group_state'});
            p_user.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            p_user.defaultValue = useid;

            var subTabla = form.addSublist({id: 'custpage_id_sub',type: serverWidget.SublistType.LIST,label: LblSublist});

            librarySales.llenadoSubTabla(subTabla, Language);

            form.addSubmitButton({label: BtnSave});
            form.addButton({id:'id_cancel',label: BtnBack,functionName: 'funcionCancel'});

            form.clientScriptModulePath = './WTH_Library/LMRY_New_LatamTax_Details_CLNT.js';
            context.response.writePage(form);

          }else{

            var params = {};
            params['custscript_lmry_new_latamtax_user'] = context.request.parameters.id_user;
            params['custscript_lmry_new_latamtax_state'] = context.request.parameters.custpage_st_proc;

            try{

              var rediMprd = task.create({
                  taskType: task.TaskType.MAP_REDUCE,
                  scriptId: 'customscript_lmry_newlatamtax_sales_mprd',
                  deploymentId: 'customdeploy_lmry_newlatamtax_sales_mprd',
                  params: params
              });
              rediMprd.submit();

              redirect.toSuitelet({
                  scriptId: 'customscript_lmry_new_latamtax_log_stlt',
                  deploymentId: 'customdeploy_lmry_new_latamtax_log_stlt'
              });

            }catch(err){
              libraryEmail.sendemail(['onRequest'] + err,LMRY_script);
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

      }catch(msgerr){
        libraryEmail.sendemail('[onRequest]' + msgerr, LMRY_script);
        log.error('Se generó un error en suitelet', msgerr);

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
      }

    }

    return {
        onRequest: onRequest
    };

});
