/*= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
  ||  This script for customer center                             ||
  ||                                                              ||
  ||  File Name:  LMRY_Archivo_Retorno_Detalle_STLT_V2.0.js       ||
  ||                                                              ||
  ||  Version Date         Author        Remarks                  ||
  ||  2.0     Oct 03 2019  LatamReady    Bundle 37714             ||
   \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/log','N/search','N/record','N/ui/serverWidget','N/url','./Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],

function(log,search,record,serverWidget,url,library_email) {

    var LMRY_script = 'Latamready - BR Archivo Retorno Detalle STLT';

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
        var form = serverWidget.createForm( { title: 'LatamReady - Log Details Return File' } );

        //form.addButton({id:'id_home',label:'Home',functionName:'funcionCancel'});

        var log_id = context.request.parameters.logid;

        var sublista = form.addSublist({id:'id_sublista',label:'Resultados',type:serverWidget.SublistType.STATICLIST});

        sublista.addRefreshButton();

        sublista.addField({id:'id_internalid',type:serverWidget.FieldType.TEXT,label:'CONTADOR'});
        sublista.addField({id:'id_subsidiary',type:serverWidget.FieldType.TEXT,label:'SUBSIDIARY'});
        sublista.addField({id:'id_employee',type:serverWidget.FieldType.TEXT,label:'USER'});
				sublista.addField({id:'id_payment',type:serverWidget.FieldType.TEXT,label:'PAYMENT'});
        var mora = sublista.addField({id:'id_mora',type:serverWidget.FieldType.TEXT,label: 'INTEREST PAYMENT'});

        var search_archivo = search.lookupFields({type:'customrecord_lmry_br_log_return_file',id:log_id,
        columns:['custrecord_lmry_br_log_return_subsidiary','custrecord_lmry_br_log_return_user','custrecord_lmry_br_log_return_payment']});

        var payments = (search_archivo.custrecord_lmry_br_log_return_payment).split(';');

        for(var i=0;i<payments.length;i++){
          var aux_payment = payments[i].split('|');

          sublista.setSublistValue({id:'id_internalid',line:i,value:(i+1).toFixed(0)});

          if(search_archivo.custrecord_lmry_br_log_return_subsidiary != '' && search_archivo.custrecord_lmry_br_log_return_subsidiary != null){
            sublista.setSublistValue({id:'id_subsidiary',line:i,value:search_archivo.custrecord_lmry_br_log_return_subsidiary[0].text});
          }
          if(search_archivo.custrecord_lmry_br_log_return_user != '' && search_archivo.custrecord_lmry_br_log_return_user != null){
            sublista.setSublistValue({id:'id_employee',line:i,value:search_archivo.custrecord_lmry_br_log_return_user[0].text});
          }

          var c = 1;

          if(aux_payment[0]=='true'){
            if(aux_payment[1] != null && aux_payment[1] != ''){
              var search_mora = search.lookupFields({type:'customerpayment',id:aux_payment[1],columns:['tranid']});
              var link_mora = url.resolveRecord({recordType:'customerpayment',recordId:aux_payment[1],isEditMode:false});

              sublista.setSublistValue({id:'id_mora',line:i,value:'<a href="'+link_mora+'" target="_blank">'+search_mora.tranid+'</a>'});
            }

            c++;

          }

          if(aux_payment[c] != null && aux_payment[c] != ''){
            var search_payment = search.lookupFields({type:'customerpayment',id:aux_payment[c],columns:['tranid']});
            if(JSON.stringify(search_payment) != '{}'){
              var link_payment = url.resolveRecord({recordType:'customerpayment',recordId:aux_payment[c],isEditMode:false});
              sublista.setSublistValue({id:'id_payment',line:i,value:'<a href="'+link_payment+'" target="_blank">'+search_payment.tranid+'</a>'});
            }

          }
        }

        //form.clientScriptModulePath = './EI_Library/LMRY_Invoicing_Populate_CLNT.js';

        context.response.writePage(form);
      }catch(error){
        //library.sendemail(' [ onRequest ] ' + error, LMRY_script);
        library_email.sendemail('[ onRequest ]' + error,LMRY_script);
				log.error('[onRequest]',error);
      }



    }

    return {
        onRequest: onRequest
    };

});
