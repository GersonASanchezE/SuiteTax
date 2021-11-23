/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for EI Advanced Flow & Universal Setting       ||
||                                                              ||
||  File Name: LMRY_Invoicing_Populate_STLT.js                  ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 01 2019  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/log', 'N/xml', 'N/format', 'N/config', 'N/redirect', 'N/url', 'N/task', 'N/search', 'N/record', 'N/ui/serverWidget', 'N/runtime', './EI_Library/LMRY_IP_libSendingEmailsLBRY_V2.0', './EI_Library/LMRY_EI_libSendingEmailsLBRY_V2.0'],

function(log ,xml, format, config, redirect, url, task, search, record, serverWidget, runtime, library, libraryFeature) {

    var LMRY_script = 'LatamReady - Invoicing Populate STLT';

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

        var current_role = runtime.getCurrentUser().roleId;

        if(context.request.method == 'GET'){

          var form = serverWidget.createForm({title:'LatamReady - Advanced Sales Flow'});

          var Rd_Subsi = context.request.parameters.custparam_subsi;
          var Rd_Date = context.request.parameters.custparam_date;
          var Rd_Date_2 = context.request.parameters.custparam_date_2;
          var Rd_Country = context.request.parameters.custparam_country;
          var Rd_Transaction = context.request.parameters.custparam_transaction;

          var allLicenses = libraryFeature.getAllLicenses();

          /*var idFeature = {
            'AR': 341, 'BR': 339, 'CL': 342, 'CO': 343, 'CR': 523, 'EC': 601, 'MX': 338, 'PA': 441, 'PE': 344
          };*/

          var idFeature = {
            'AR': 341, 'BR': 339, 'CL': 342, 'CO': 343, 'CR': 523, 'MX': 338, 'PA': 441, 'PE': 344
          };

          //Primary Information
		      form.addFieldGroup({id: 'group_pi',label: 'Primary Information'});

          if(subsi_OW){
            var f_subsi = form.addField({id:'custpage_subsi',type: 'select',label:'SUBSIDIARY',container:'group_pi'});
            f_subsi.isMandatory = true;

            var searchSub = search.create({type: 'subsidiary',columns:['name','internalid'],filters:[
              {name:'isinactive',operator:'is',values:'F'},{name: 'country', operator: 'anyof', values: Object.keys(idFeature)}
            ]});
            var resultSub = searchSub.run().getRange({start:0,end:1000});

            if(resultSub != null && resultSub.length > 0){
              f_subsi.addSelectOption({value:0,text:' '});
              for(var i=0; i<resultSub.length;i++){
                var subsi_id = resultSub[i].getValue('internalid');
                var subsi_name = resultSub[i].getValue('name');

                f_subsi.addSelectOption({value:subsi_id,text:subsi_name});
              }
            }

          }

          var p_country = form.addField({id:'custpage_country',type:serverWidget.FieldType.TEXT,label:'COUNTRY',container:'group_pi'});
          p_country.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
          p_country.updateDisplaySize({height:60,width:30});

          if(!subsi_OW){
            var countryConfig = config.load({type:config.Type.COMPANY_INFORMATION});
            countryConfig = countryConfig.getText({fieldId:'country'});

            p_country.defaultValue = countryConfig;

          }

          //var p_transaction = form.addField({id: 'custpage_transaction', type: 'select', label: 'TRANSACTION', container: 'group_pi', source: '-100'});
          var p_transaction = form.addField({id: 'custpage_transaction', type: 'select', label: 'TRANSACTION', container: 'group_pi'});

		      // Modificacion 26.03-2020 : Grupo - Date Ranges
		      form.addFieldGroup({id: 'group_rg',label: 'Date Ranges'});

          var f_date = form.addField({id:'custpage_date',type:serverWidget.FieldType.DATE,label:'DATE FROM',container:'group_rg',source:'date'});
          f_date.updateDisplaySize({height:60,width:30});
          f_date.isMandatory = true;

          var f_date_2 = form.addField({id:'custpage_date_2',type:serverWidget.FieldType.DATE,label:'DATE TO',container:'group_rg',source:'date'});
          f_date_2.updateDisplaySize({height:60,width:30});
          f_date_2.isMandatory = true;

          //CONTEO DE TRANSACCIONES
          if(Rd_Country){

            form.addFieldGroup({id: 'group_count',label: 'Transaction Count'});

            var fNumber = form.addField({id: 'custpage_number', type: serverWidget.FieldType.INTEGER, label: 'NUMBER OF TRANSACTIONS', container: 'group_count'});
            fNumber.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            fNumber.updateDisplaySize({height:60,width:30});

            var fSeleccionadas = form.addField({id: 'custpage_seleccionadas', type: serverWidget.FieldType.INTEGER, label: 'NUMBER OF SELECTED TRANSACTIONS', container: 'group_count'});
            fSeleccionadas.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            fSeleccionadas.updateDisplaySize({height:60,width:30});
            fSeleccionadas.defaultValue = 0;

            var fSelectTransaction = form.addField({id: 'custpage_select', type: serverWidget.FieldType.SELECT, label: 'SELECT TRANSACTIONS', container: 'group_count'});
            fSelectTransaction.addSelectOption({value: '', text: ' '});
            fSelectTransaction.addSelectOption({value: 500, text: '500 transactions'});
            fSelectTransaction.addSelectOption({value: 1000, text: '1000 transactions'});
            fSelectTransaction.addSelectOption({value: 2000, text: '2000 transactions'});

            fSelectTransaction.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});

            var fQuantity = form.addField({id: 'custpage_quantity', type: serverWidget.FieldType.INTEGER, label: 'TRANSACTIONS TO SELECT', container: 'group_count'});
            fQuantity.updateDisplaySize({height:60,width:30});

          }

          if(runtime.envType == 'SANDBOX' || runtime.accountId.indexOf('TSTDRV') == 0){
            var myInlineHtml = form.addField( { id: 'custpage_id_message',label: 'MESSAGE', type: serverWidget.FieldType.INLINEHTML} );
              myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
              //myInlineHtml.updateBreakType({breakType : serverWidget.FieldBreakType.STARTCOL});

              var strhtml = "<html>";
                strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
                strhtml += "<tr>";
                strhtml += "</tr>";
                strhtml += "<tr>";
                strhtml += "<td class='text'>";
                strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">";
                strhtml += "Revisar que los datos de autentificacion no apunten al ambiente de Produccion. </div>";
                strhtml += "</td>";
                strhtml += "</tr>";
                strhtml += "</table>";
                strhtml += "</html>";

              myInlineHtml.defaultValue = strhtml;
          }

          var f_sublist = form.addSublist({id:'custpage_sublista',label:'INVOICES',type:serverWidget.SublistType.LIST});
          f_sublist.addField({id:'id_apply',type:serverWidget.FieldType.CHECKBOX,label:'APPLY'});
          f_sublist.addField({id:'id_int',type:serverWidget.FieldType.TEXT,label:'INTERNAL ID'});
          f_sublist.addField({id:'id_tran',type:serverWidget.FieldType.TEXT,label:'TRANID'});
          f_sublist.addField({id:'id_type',type:serverWidget.FieldType.TEXT,label:'TRANSACTION'});
          f_sublist.addField({id:'id_date',type:serverWidget.FieldType.DATE,label:'DATE'});
          f_sublist.addField({id:'id_ent',type:serverWidget.FieldType.TEXT,label:'CUSTOMER'});
          f_sublist.addField({id:'id_doc',type:serverWidget.FieldType.TEXT,label:'DOCUMENT TYPE'});
          f_sublist.addField({id:'id_memo',type:serverWidget.FieldType.TEXT,label:'MEMO'});
          f_sublist.addField({id:'id_amount',type:serverWidget.FieldType.TEXT,label:'AMOUNT'});

          if(Rd_Country){

            p_country.defaultValue = Rd_Country;

            Rd_Country = Rd_Country.substring(0,3).toUpperCase();
            var country_acento = Rd_Country;
            Rd_Country = validarAcentos(Rd_Country);

            var featureAdvanced = false;

            if(subsi_OW){
              var licenses = libraryFeature.getLicenses(Rd_Subsi);

              featureAdvanced = advanced(licenses, Rd_Country, idFeature);

            }else{
              var key = Object.keys(allLicenses)[0];

              var licenses = libraryFeature.getLicenses(key);

              featureAdvanced = advanced(licenses, Rd_Country, idFeature);

            }

            //VALIDACION EI - PACKAGE
            if(featureAdvanced){

              var filtrosPackage = [];

              filtrosPackage[0] = search.createFilter({name: 'isinactive', operator: 'is', values: "F"});
              filtrosPackage[1] = search.createFilter({name: 'custrecord_lmry_ei_pckg_sm', operator: 'noneof', values: "@NONE@"});
              filtrosPackage[2] = search.createFilter({name: 'custrecord_lmry_ei_pckg_template', operator: 'noneof', values: "@NONE@"});
              filtrosPackage[3] = search.createFilter({name: 'custrecord_lmry_ei_pckg_doc_type', operator: 'isnotempty', values: ""});
              if(subsi_OW){
                filtrosPackage[4] = search.createFilter({name: 'custrecord_lmry_ei_pckg_subsi', operator: 'anyof', values: Rd_Subsi});
              }

              var searchPackage = search.create({type: 'customrecord_lmry_ei_pckg', filters: filtrosPackage, columns: ['custrecord_lmry_ei_pckg_doc_type','custrecord_lmry_ei_pckg_trans_type']});
              var resultPackage = searchPackage.run().getRange({start:0,end:1000});

              var jsonPackage = {};
              if(resultPackage != null && resultPackage.length > 0){
                for(var i = 0; i < resultPackage.length; i++){
                  var documento = resultPackage[i].getValue('custrecord_lmry_ei_pckg_doc_type');
                  var transaccion = resultPackage[i].getValue('custrecord_lmry_ei_pckg_trans_type');

                  if(Rd_Country == 'BRA' && transaccion){
                    if(transaccion == '7'){
                      transaccion = 'custinvc';
                    }else if(transaccion == '32'){
                      transaccion = 'itemship';
                    }
                    jsonPackage[documento + ";" + transaccion] = documento;
                  }else{
                    jsonPackage[documento] = documento;
                  }


                }
              }

              //log.error('jsonPackage',JSON.stringify(jsonPackage));

            }

            var f_state = form.addField({id:'custpage_state',label:'STATE',type:serverWidget.FieldType.TEXT,container:'group_pi'});
            f_state.defaultValue = 'PENDIENTE';

            //BUSQUEDA TIPO DE DOCUMENTO
            var filtros_document = [], json_document = {};
            filtros_document[0] = search.createFilter({name:'isinactive',operator:'is',values:'F'});
            filtros_document[1] = search.createFilter({name:'custrecord_lmry_fact_electronica',operator:'is',values:'T'});
            filtros_document[2] = search.createFilter({name:'formulatext',formula:'{custrecord_lmry_country_applied}',operator:'startswith',values:country_acento});

            var search_document = search.create({type:'customrecord_lmry_tipo_doc',columns:['internalid'],filters:filtros_document});
            var result_document = search_document.run().getRange({start:0,end:1000});

            if(result_document != null && result_document.length > 0){
              for(var i=0;i<result_document.length;i++){
                json_document[result_document[i].getValue('internalid')] = result_document[i].getValue('internalid');
              }
            }

            //log.error('json_document',json_document);

			      var type_transaction = 'transaction';

            if(Rd_Transaction != null && Rd_Transaction != '' && Rd_Transaction != '0'){
              Rd_Transaction = Rd_Transaction.split(';');
              type_transaction = Rd_Transaction[0];
            }

            //FEATURE RETENCIONES
            var brRetenciones = libraryFeature.getAuthorization(416, licenses);
            var coRetenciones = libraryFeature.getAuthorization(27, licenses);
            var coRetencionesLines = libraryFeature.getAuthorization(340, licenses);

            //BUSQUEDA INVOICE
            var filtros_invoice = [];
            filtros_invoice[0] = search.createFilter({name:'mainline',operator:'is',values:'T'});
            filtros_invoice[1] = search.createFilter({name:'trandate',operator:'onorbefore',values:Rd_Date_2});
            filtros_invoice[2] = search.createFilter({name:'trandate',operator:'onorafter',values:Rd_Date});
            //filtros_invoice[4] = [["type","anyof","CustCred"],"OR",[["type","anyof","CustInvc"],"AND",["amountpaid","equalto","0.00"]]];
            //filtros_invoice[4] = search.createFilter({name:'amountpaid',operator:'equalto',values:0});
            //filtros_invoice[4] = search.createFilter({name:'status',operator:'anyof',values:['CustInvc:A','CustCred:A']});

            var i = 3;
            if(subsi_OW){
              filtros_invoice[i] = search.createFilter({name:'subsidiary',operator:'is',values: Rd_Subsi});
              i++;
            }

            if(type_transaction == 'transaction'){
              if(Rd_Country == 'BRA'){
                filtros_invoice[i] = search.createFilter({name:'type',operator:'anyof',values:['ItemShip','CustInvc']});
              }else if(Rd_Country == 'MEX'){
                filtros_invoice[i] = search.createFilter({name:'type',operator:'anyof',values:['CustCred','CustInvc','CustPymt']});
              }else if(Rd_Country == 'ECU'){
                filtros_invoice[i] = search.createFilter({name:'type',operator:'anyof',values:['CustCred','CustInvc']});
              }else{
                filtros_invoice[i] = search.createFilter({name:'type',operator:'anyof',values:['CustCred','CustInvc']});
              }
				      i++;
            }

            //Tipo de documento vacio
            if(featureAdvanced == false){
				        filtros_invoice[i] = search.createFilter({name:'custbody_lmry_document_type',operator:'anyof',values:['@NONE@']});
				        i++;
            }

			      // Solo para colombia excluye las retenciones Latam - WHT
            if(Rd_Country == 'COL'){
				       filtros_invoice[i] = search.createFilter({name: 'memo', operator: 'doesnotstartwith', values: ['Latam - WHT'] });
				       i++;
               filtros_invoice[i] = search.createFilter({name: 'memo', operator: 'doesnotstartwith', values: ['Latam - Country WHT'] });
               i++;
            }

            if(Rd_Country == 'MEX'){
              filtros_invoice[i] = search.createFilter({name: 'memo', operator: 'doesnotcontain', values: ['void'] });
              i++;
            }

            if(Rd_Country == 'PER'){
              filtros_invoice[i] = search.createFilter({name: 'memo', operator: 'doesnotcontain', values: ['VOID'] });
              i++;
            }

            if(Rd_Country == 'BRA'){
				      filtros_invoice[i] = search.createFilter({name: 'custbody_lmry_carga_inicial', operator: 'is', values: ['F'] });
              i++;
            }

			      // Crea la busqueda segun los filtros seleccionados
            if(subsi_OW){
              var search_invoice = search.create({type: type_transaction, filters:filtros_invoice,
                columns:[search.createColumn({name:'type',sort: search.Sort.ASC}),search.createColumn({name:'trandate',sort: search.Sort.ASC}),search.createColumn({name:'tranid',sort: search.Sort.ASC}),
                'entity','internalid','status','fxamount','externalid','custbody_lmry_document_type','amountpaid','memo','total'],
              settings: [search.createSetting({name: 'consolidationtype',value: 'NONE'})]
              });
            }else{
              var search_invoice = search.create({type: type_transaction, filters:filtros_invoice,
                columns:[search.createColumn({name:'type',sort: search.Sort.ASC}),search.createColumn({name:'trandate',sort: search.Sort.ASC}),search.createColumn({name:'tranid',sort: search.Sort.ASC}),
                'entity','internalid','status','fxamount','externalid','custbody_lmry_document_type','amountpaid','memo','total']});
            }

            var result_invoice = search_invoice.run();
            var result_invoice3 = result_invoice.getRange({start:0,end:900});

            //BUSQUEDA AUXILIAR SIN MAINLINE PARA EL DESCUENTO
            var jsonDiscount = {};
            if(Rd_Country == 'BRA'){
              filtros_invoice.splice(1,1);
              filtros_invoice.push(search.createFilter({name:'transactiondiscount', operator: 'is', values: 'T'}));
              var cDiscount = 0, banderaDiscount = true;
              var searchDiscount = search.create({type: type_transaction, filters: filtros_invoice, columns: ['rate','internalid'], settings: [search.createSetting({name: 'consolidationtype',value: 'NONE'})] });
              var resultDiscount = searchDiscount.run();
              var resultDiscountIt = resultDiscount.getRange({start:cDiscount,end:cDiscount + 1000});

              if(resultDiscountIt != null && resultDiscountIt.length){
                while(banderaDiscount){
                  resultDiscountIt = resultDiscount.getRange({start:cDiscount,end:cDiscount + 1000});
                  for(var i = 0; i < resultDiscountIt.length; i++){
                    var rate = resultDiscountIt[i].getValue('rate');
                    var idInvoiceDiscount = resultDiscountIt[i].getValue('internalid');

                    if(rate == -100){
                      jsonDiscount[idInvoiceDiscount] = idInvoiceDiscount;
                    }
                  }

                  if(resultDiscountIt.length == 1000){
                    cDiscount += 1000;
                  }else{
                    banderaDiscount = false;
                  }


                }
              }

              //log.error('jsonDiscount',JSON.stringify(jsonDiscount));

            }


            //BUSQUEDA PRINCIPAL
            var status_countries = ['Aprobado', 'Observado', 'EMITIDO', 'APROBADO POR SII', 'APROBADO', 'AUTORIZADO', 'Procesando', 'PROCESANDO', 'Autorizado', 'Generado','ACEPTADO','Cancelada','Cancelado','Denegada','Cancelando','No Cancelado','No Cancelada','EMILOCAL'];
            var bandera = true;
            var contador = 0;
            var c = 0;

            var arregloFinal = [];

            if(result_invoice3 != null && result_invoice3.length > 0){
              while(bandera){
                result_invoice2 = result_invoice.getRange({start:contador,end:contador+900});

                if(result_invoice2 != null && result_invoice2.length>0){
                var transacciones = [];
                for(var j=0;j<result_invoice2.length;j++){
                  transacciones.push(result_invoice2[j].getValue('internalid'));
                  //arregloFinal.push(result_invoice2[j].getValue('internalid'));
                }

                var json_response = status_invoice(Rd_Country,transacciones);

                  for(var i=0;i<result_invoice2.length;i++){
                    var id_invoice = result_invoice2[i].getValue('internalid');
                    var id_entity = result_invoice2[i].getText('entity');
                    var id_entity_value = result_invoice2[i].getValue('entity');
                    var id_tran = result_invoice2[i].getValue('tranid');
                    var id_amount = result_invoice2[i].getValue('fxamount');
                    var id_doc = result_invoice2[i].getText('custbody_lmry_document_type');
                    var id_doc_value = result_invoice2[i].getValue('custbody_lmry_document_type');
                    var id_date = result_invoice2[i].getValue('trandate');
                    var id_type = result_invoice2[i].getValue('type');
                    id_type = id_type.toLowerCase();

                    var id_amountpaid = result_invoice2[i].getValue('amountpaid');
                    var id_status = result_invoice2[i].getValue('status');
                    id_status = id_status.toLowerCase();
                    var id_memo = result_invoice2[i].getValue('memo');
                    var id_total = result_invoice2[i].getValue('total');

                    //ESTADOS DE FACTURACION
                    if(status_countries.indexOf(json_response[id_invoice][0]) != -1){
                      continue;
                    }

                    //VALIDACIONES CUANDO ES INVOICE
                    if(id_type == 'custinvc'){
                      if(Rd_Country != 'BRA' && (id_status != 'open' || id_amountpaid == id_total)){
                        continue;
                      }

                      if(Rd_Country == 'BRA'){

                        //Si tiene pago parcial, sigue siendo open
                        if(id_amountpaid > 0 && brRetenciones == false){
                          continue;
                        }

                        //Probablemente paid in full, solo descuento al 100%
                        if(id_status != 'open' && (jsonDiscount[id_invoice] == null || jsonDiscount[id_invoice] == undefined)){
                          continue;
                        }


                      }else if(Rd_Country == 'COL'){
                        if(id_amountpaid > 0 && coRetenciones == false && coRetencionesLines == false){
                          continue;
                        }
                      }else{
                        if(id_amountpaid != 0){
                          continue;
                        }
                      }

                    }

                    //VIP
                    if(featureAdvanced){
                      if(id_doc != null && id_doc != ''){
                        //SI EL DOC NO ES DE FACTURACION
                        if(json_document[result_invoice2[i].getValue('custbody_lmry_document_type')] == undefined || json_document[result_invoice2[i].getValue('custbody_lmry_document_type')] == null){
                          continue;
                        }

                        //SI EL DOCUMENTO NO TIENE EI-PACKAGE, NO LO MUESTRA
                        if(Rd_Country != 'BRA'){
                          if(jsonPackage[id_doc_value] == null || jsonPackage[id_doc_value] == undefined){
                            continue;
                          }
                        }else{
                          if(jsonPackage[id_doc_value + ";" + id_type] == null || jsonPackage[id_doc_value + ";" + id_type] == undefined){
                            continue;
                          }
                        }

                      }
                    }

                    if(id_doc == null || id_doc == ''){
                      id_doc = ' ';
                    }

                    f_sublist.setSublistValue({id:'id_type',line: c, value: result_invoice2[i].getText('type')});
                    f_sublist.setSublistValue({id:'id_int',line:c,value:id_invoice});

                    if(id_entity){
                      f_sublist.setSublistValue({id:'id_ent',line:c,value:id_entity});
                    }else{
                      f_sublist.setSublistValue({id:'id_ent',line:c,value:' '});
                    }

                    if(id_tran == null || id_tran == ''){
                      id_tran = ' ';
                    }

                    f_sublist.setSublistValue({id:'id_tran',line:c,value:id_tran});

                    if(id_type != 'itemship'){
                      f_sublist.setSublistValue({id:'id_amount',line:c,value: id_amount});
                    }else{
                      f_sublist.setSublistValue({id:'id_amount',line:c,value: ' '});
                    }

                    f_sublist.setSublistValue({id:'id_doc',line:c,value:id_doc});
                    f_sublist.setSublistValue({id:'id_date',line:c,value:id_date});

                    if(id_memo == null || id_memo == ''){
                      id_memo = ' ';
                    }else{
                      id_memo = id_memo.substring(0,50) + "...";
                    }

                    f_sublist.setSublistValue({id:'id_memo',line:c,value:id_memo});

                    c++;

                  }//FOR
                } //LLENADO SUBLISTA IF

                if(result_invoice2.length == 900){
                  contador = contador + 900;
                }else{
                  bandera = false;
                }

              } //WHILE
            }

            f_sublist.addButton({id:'id_mark',label:'MARK ALL',functionName:'markAll(' + c + ')'});
            f_sublist.addButton({id:'id_desmark',label:'DESMARK ALL',functionName:'desmarkAll'});

            fNumber.defaultValue = c;

            if(subsi_OW){
              f_subsi.defaultValue = Rd_Subsi;
              f_subsi.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            }

            f_date.defaultValue = Rd_Date;
            f_date_2.defaultValue = Rd_Date_2;

            if(Rd_Transaction != null && Rd_Transaction != '' && Rd_Transaction != '0'){
              p_transaction.addSelectOption({value: Rd_Transaction[0], text: Rd_Transaction[1]});
            }


            f_date.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            f_date_2.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            f_state.updateDisplayType({displayType:serverWidget.FieldDisplayType.DISABLED});
            p_transaction.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

            form.addButton({id:'id_cancel',label:'Back',functionName:'funcionCancel'});

          }

          form.clientScriptModulePath = './EI_Library/LMRY_Invoicing_Populate_CLNT.js';

          if(Rd_Subsi != null && Rd_Subsi != ''){
            form.addSubmitButton({label:'Save'});
          }else{
            form.addSubmitButton({label:'Filter'});
            form.addResetButton({label:'Reset'});
          }

          context.response.writePage(form);

        }else{

          var p_state = context.request.parameters.custpage_state;

          var auxSubsi = subsi_OW ? context.request.parameters.custpage_subsi : 1;

          if(p_state == null || p_state == ''){
            redirect.toSuitelet({scriptId:'customscript_lmry_invoicing_populat_stlt',
              deploymentId:'customdeploy_lmry_invoicing_populat_stl',
              parameters:{
                'custparam_subsi' : auxSubsi,
                'custparam_doctype' : context.request.parameters.custpage_doctype,
                'custparam_date' : context.request.parameters.custpage_date,
                'custparam_date_2' : context.request.parameters.custpage_date_2,
                'custparam_country' : context.request.parameters.custpage_country,
                'custparam_transaction' : context.request.parameters.custpage_transaction
              }
            });
          }else{

            var usuario = runtime.getCurrentUser().id;

            var params = {};
            params['custscript_lmry_ip_params_state'] = context.request.parameters.custpage_state;
            params['custscript_lmry_ip_params_user'] = usuario;

            log.error('params',params);

            var country = context.request.parameters.custpage_country;
            country = country.substring(0,3).toUpperCase();
            country = validarAcentos(country);

            var setting = [task.TaskType.MAP_REDUCE,'customscript_lmry_invoicing_populate_mr'];

            var redi_sche = '';

            switch (country) {
              case 'ARG': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_populate_mr', params : params});break;
              case 'BRA': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_pop_br_mr', params : params});break;
              case 'CHI': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_pop_ch_mr', params : params});break;
              case 'COL': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_pop_co_mr', params : params});break;
              case 'MEX': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_pop_mx_mr', params : params});break;
              case 'PER': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_pop_pe_mr', params : params});break;
              case 'PAN': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_pop_pa_mr', params : params});break;
              case 'COS': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_pop_cr_mr', params : params});break;
              case 'ECU': redi_sche = task.create({taskType: setting[0], scriptId: setting[1], deploymentId: 'customdeploy_lmry_invoicing_pop_ec_mr', params : params});break;

            }

            redi_sche.submit();

            redirect.toSuitelet({
                scriptId: 'customscript_lmry_invoicing_log_stlt',
                deploymentId: 'customdeploy_lmry_invoicing_log_stlt',
                params: params
            });


        }

        }

      }catch(msgerr){

        var formError = serverWidget.createForm({title: 'LatamReady - Advanced Sales Flow'});
        var myInlineHtml = formError.addField({id: 'custpage_id_message', label: 'MESSAGE', type: serverWidget.FieldType.INLINEHTML});
        myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
        myInlineHtml.updateBreakType({breakType: serverWidget.FieldBreakType.STARTCOL});

        var strhtml = "<html>";
        strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
        strhtml += "<tr>";
        strhtml += "</tr>";
        strhtml += "<tr>";
        strhtml += "<td class='text'>";
        strhtml += "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">";
        strhtml += "Importante: El acceso no esta permitido.<br><br>";
        strhtml += "<br>Code :" + xml.escape(msgerr.name);
        strhtml += "<br>Details :" + xml.escape(msgerr.message);
        strhtml += "</div>";
        strhtml += "</td>";
        strhtml += "</tr>";
        strhtml += "</table>";
        strhtml += "</html>";

        // Mensaje HTML
        myInlineHtml.defaultValue = strhtml;

        // Dibuja el Formulario
        context.response.writePage(formError);
        log.error({title: 'Se genero un error en suitelet',details: msgerr});

        // Envio de mail al clientes
        library.sendemail(' [ onRequest ] ' + msgerr, LMRY_script);
      }


    }

    function advanced(licenses, country, idFeature){

      var country3country2 = {'ARG': 'AR', 'BRA': 'BR', 'CHI': 'CL', 'COL': 'CO', 'COS': 'CR', 'ECU': 'EC', 'MEX': 'MX', 'PAN': 'PA', 'PER': 'PE'}; //G.G

      return libraryFeature.getAuthorization(idFeature[country3country2[country]], licenses);

    }

    function validarAcentos(s) {
      var AccChars = "ŠŽšžŸÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïðñòóôõöùúûüýÿ&°–—ªº·";
      var RegChars = "SZszYAAAAAACEEEEIIIIDNOOOOOUUUUYaaaaaaceeeeiiiidnooooouuuuyyyo--ao.";

      s = s.toString();
      for (var c = 0; c < s.length; c++) {
          for (var special = 0; special < AccChars.length; special++) {
              if (s.charAt(c) == AccChars.charAt(special)) {
                  s = s.substring(0, c) + RegChars.charAt(special) + s.substring(c + 1, s.length);
              }
         }
      }
      return s;

    }

    function status_invoice(country, arregloInvoice){

      //STATUS, STATUS-COUNTRY, HORA-COUNTRY, STATUS-GLOBAL, HORA-GLOBAL
      var json_full = {};

      for(var j=0;j<arregloInvoice.length;j++){
        if(json_full[arregloInvoice[j]] == null || json_full[arregloInvoice[j]] == undefined){
          json_full[arregloInvoice[j]] = [];
          json_full[arregloInvoice[j]].push('No');
          json_full[arregloInvoice[j]].push('No');
          json_full[arregloInvoice[j]].push(0);
          json_full[arregloInvoice[j]].push('No');
          json_full[arregloInvoice[j]].push(0);
        }

      }

      var posicion = -1;

      //ARGENTINA,BRAZIL,CHILE Y COLOMBIA;
      var record = ['customrecord_lmry_ei_docs_status'];
      //STATUS: OTROS-MEXICO-PERU
      var columnas = ['custrecord_lmry_ei_ds_doc_status','custbody_lmry_pe_estado_sf','custbody_lmry_pe_estado_comfiar'];

      var filtros = [
        search.createFilter({name:'custrecord_lmry_ei_ds_doc',operator:'anyof',values:arregloInvoice})
      ]

      //IDS
      var columnas2 = ['custrecord_lmry_ei_ds_doc'];

      switch (country){
        case 'ARG': posicion = 0;break;
        case 'BRA': posicion = 0;break;
        case 'CHI': posicion = 0;break;
        case 'COL': posicion = 0;break;
        case 'MEX': posicion = 1;break;
        case 'PER': posicion = 2;break;
        case 'PAN': posicion = 0;break;
        case 'COS': posicion = 0;break;
        case 'ECU': posicion = 0;break;
      }

      if(country == 'MEX' || country == 'PER'){

        var search_custbody = search.create({type:search.Type.TRANSACTION,columns:[columnas[posicion],'internalid'],filters:[{name:'internalid',operator:'anyof',values:arregloInvoice},
        {name:'mainline',operator:'is',values:'T'},{name:'type',operator:'anyof',values:['CustInvc','CustCred','CustPymt']}]
        });
        var result_custbody = search_custbody.run().getRange({start:0,end:1000});

        if(result_custbody != null && result_custbody.length > 0){
          for(var i=0;i<result_custbody.length;i++){
            json_full[result_custbody[i].getValue('internalid')][0] = result_custbody[i].getValue(columnas[posicion]);
          }
        }

      }else{

        //RECORD COUNTRY
        var search_r_status = search.create({type: 'customrecord_lmry_ei_docs_status', columns:['custrecord_lmry_ei_ds_doc_status','custrecord_lmry_ei_ds_doc','lastmodified'],
        filters:[{name:'custrecord_lmry_ei_ds_doc', operator:'anyof', values: arregloInvoice}]
        });

        var result_r_status = search_r_status.run().getRange({start:0, end:1000});

        if(result_r_status != null && result_r_status.length > 0){
          for(var i=0;i<result_r_status.length;i++){
            json_full[result_r_status[i].getValue('custrecord_lmry_ei_ds_doc')][0] = result_r_status[i].getValue('custrecord_lmry_ei_ds_doc_status');

          }

        }

      }

      return json_full;

    }

    return {
        onRequest: onRequest
    };

});
