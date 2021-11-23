/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for EI Avance Flow & Universal Setting         ||
||                                                              ||
||  File Name: LMRY_Invoicing_Populate_Log_STLT.js              ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 01 2019  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/runtime', 'N/log', 'N/search', 'N/record', 'N/ui/serverWidget', 'N/url', './EI_Library/LMRY_IP_libSendingEmailsLBRY_V2.0'],

function(runtime, log, search, record, serverWidget, url, library) {

    var LMRY_script = 'Latamready - Invoicing Log STLT';

    var subsi_OW = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});

    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {

      try{
        var form = serverWidget.createForm( { title: 'LatamReady - Log Advanced Sales Flow' } );

        var p_hidden = form.addField({id: 'custpage_hidden', label: 'HIDDEN', type: serverWidget.FieldType.TEXT});
        p_hidden.defaultValue = 'Hidden';
        p_hidden.updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});

        form.addButton({id:'id_home',label:'Home',functionName:'funcionCancel'});

        var myInlineHtml = form.addField( { id: 'custpage_id_message',label: 'MESSAGE', type: serverWidget.FieldType.INLINEHTML });
          myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
          myInlineHtml.updateBreakType({breakType : serverWidget.FieldBreakType.STARTCOL});

        var strhtml = "<html>";
          strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
          strhtml += "<tr>";
          strhtml += "</tr>";
          strhtml += "<tr>";
          strhtml += "<td class='text'>";
          strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">";
          strhtml += "Nota: Se esta procesando las transacciones. ";
          strhtml += "La columna [STATE] indica el estado del proceso.<br><br>";
          strhtml += "Presionar el boton refresh para ver si el proceso termino.</div>";
          strhtml += "</td>";
          strhtml += "</tr>";
          strhtml += "</table>";
          strhtml += "</html>";

        myInlineHtml.defaultValue = strhtml;

        var sublista = form.addSublist({id:'id_sublista',label:'Resultados',type:serverWidget.SublistType.STATICLIST});

        sublista.addRefreshButton();

        sublista.addField({id:'id_internalid', type:serverWidget.FieldType.TEXT,label:'INTERNAL ID'});

        if(subsi_OW){
          sublista.addField({id:'id_subsidiary', type:serverWidget.FieldType.TEXT,label:'SUBSIDIARY'});
        }

        sublista.addField({id:'id_date', type:serverWidget.FieldType.TEXT,label:'CREATED DATE'});
        sublista.addField({id:'id_employee', type:serverWidget.FieldType.TEXT,label:'EMPLOYEE'});
        sublista.addField({id:'id_transactions', type:serverWidget.FieldType.TEXTAREA,label:'TRANSACTIONS'});
        sublista.addField({id:'id_total', type:serverWidget.FieldType.TEXT, label: '# TRANSACTIONS'});
        sublista.addField({id:'id_percentage', type:serverWidget.FieldType.TEXT, label: 'PERCENTAGE'});
        sublista.addField({id:'id_state', type:serverWidget.FieldType.TEXTAREA,label:'STATE'});

        sublista.addField({id:'id_link', type: serverWidget.FieldType.TEXT,label:'LINK'});


        var search_log = search.create({type:'customrecord_lmry_invoicing_populate',columns:[search.createColumn({name: "internalid",sort: search.Sort.DESC}),
        'custrecord_lmry_ip_user','custrecord_lmry_ip_subsidiary','custrecord_lmry_ip_transactions','custrecord_lmry_ip_state','created','custrecord_lmry_ip_url',
        'custrecord_lmry_ip_error','custrecord_lmry_ip_count']});

        var result_log = search_log.run().getRange({start:0,end:1000});

        if(result_log != null && result_log.length>0){
          var columnas = result_log[0].columns;
          for(var i=0;i<result_log.length;i++){

            var id = "" + result_log[i].getValue(columnas[0]);
            if(id != ''){
              sublista.setSublistValue({id:'id_internalid',line:i,value:id});
            }

            var employee = "" + result_log[i].getText(columnas[1]);
            if(employee != ''){
              sublista.setSublistValue({id:'id_employee',line:i,value:employee});
            }

            if(subsi_OW){
              var subsidiary = '' + result_log[i].getText(columnas[2]);
              if(subsidiary != ''){
                sublista.setSublistValue({id:'id_subsidiary',line:i,value:subsidiary});
              }
            }

            var transactions = '' + result_log[i].getValue(columnas[3]);
            if(transactions != ''){
              var url_detalle = url.resolveScript({scriptId:'customscript_lmry_log_details_invo_stlt',deploymentId:'customdeploy_lmry_log_details_invo_stlt',returnExternalUrl: false});
              url_detalle += '&logid=' + id;
              sublista.setSublistValue({id:'id_transactions',line:i,value:'<a href="'+url_detalle+'" target="_blank">'+'Detalle'+'</a>'});
            }

            var state = '' + result_log[i].getValue(columnas[4]);
            var auxState = '', c = 0;
            if(state != ''){
              for(var j = 0; j < state.length; j++){
                if(state[j] == '|'){
                  c++;
                }

                auxState += state[j];

                if(c == 6){
                  auxState += "\n";
                  c = 0;
                }
              }
              sublista.setSublistValue({id:'id_state',line:i,value:auxState});
            }

            var lastmodified = '' + result_log[i].getValue(columnas[5]);
            if(lastmodified != ''){
              sublista.setSublistValue({id:'id_date',line:i,value:lastmodified});
            }

            var link = '' + result_log[i].getValue(columnas[6]);
            if(link != ''){
              sublista.setSublistValue({id:'id_link',line:i,value:'<a href="'+link+'" target="_blank">'+'GenerateAndSend'+'</a>'});
            }

            var count = '' + result_log[i].getValue(columnas[8]);
            if(count != ''){
              count = count.split('|');
              sublista.setSublistValue({id:'id_total',line:i,value: parseInt(count[0]) + " transaction(s)"});
              if(count[1]){
                var percentage = parseInt(parseFloat(count[1])*100/parseFloat(count[0])) + "%";
                sublista.setSublistValue({id:'id_percentage',line:i,value: percentage});
              }
            }

            /*var posible_error = '' + result_log[i].getValue(columnas[7]);
            if(posible_error != ''){
              posible_error = posible_error.substring(0,300);
              sublista.setSublistValue({id:'id_error',line:i,value:posible_error});
            }*/
          }
        }

        form.clientScriptModulePath = './EI_Library/LMRY_Invoicing_Populate_CLNT.js';

        context.response.writePage(form);
      }catch(error){
        library.sendemail(' [ onRequest ] ' + error, LMRY_script);
      }



    }

    return {
        onRequest: onRequest
    };

});
