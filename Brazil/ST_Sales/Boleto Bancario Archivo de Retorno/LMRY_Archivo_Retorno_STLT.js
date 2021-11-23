/*= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
  ||  This script for customer center                             ||
  ||                                                              ||
  ||  File Name:  LMRY_Archivo_Retorno_STLT.js                    ||
  ||                                                              ||
  ||  Version Date         Author        Remarks                  ||
  ||  2.0     Oct 03 2019  LatamReady    Bundle 37714             ||
   \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/runtime', 'N/file', 'N/record', 'N/search', 'N/ui/serverWidget', 'N/redirect', 'N/task', 'N/url', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],

  function(runtime, file, record, search, serverWidget, redirect, task, url, library_email) {

    var LMRY_script = 'LatamReady - BR Archivo Retorno STLT';

    var FEAT_INSTALLMENTS = runtime.isFeatureInEffect({
      feature: "installments"
    });

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

          var Rd_File = context.request.parameters.custparam_file;
          var Rd_Sub = context.request.parameters.custparam_subsi;
          var Rd_Bank = context.request.parameters.custparam_bank;

          var ocurrencia = [];

          var form = serverWidget.createForm({
            title: 'LatamReady - Return File'
          });

          var url_detalle = url.resolveScript({
            scriptId: 'customscript_lmry_br_archivo_log_stlt',
            deploymentId: 'customdeploy_lmry_br_archivo_log_stlt',
            returnExternalUrl: false
          });
          var output = url.resolveDomain({
            hostType: url.HostType.APPLICATION,
            accountId: runtime.accountId
          });
          log.error('url_detalle', output + url_detalle);
          form.addPageLink({
            type: serverWidget.FormPageLinkType.CROSSLINK,
            title: 'LatamReady - Log Return File',
            url: 'https://' + output + url_detalle
          })

          form.addFieldGroup({
            id: 'group_pi',
            label: 'Primary Information'
          });

          //var s_folder = search.create({type:'folder',columns:['name'],filters:[{name:'internalid',operator:'is',values:37351}]});
          var f_subsidiaria = form.addField({
            id: 'custpage_subsidiary',
            label: 'SUBSIDIARY',
            type: serverWidget.FieldType.SELECT
          });
          f_subsidiaria.isMandatory = true;

          f_subsidiaria.addSelectOption({
            value: 0,
            text: ' '
          });
          //Busqueda de Subsidiaria por pais de Brasil
          var search_subsidiaria = search.create({
            type: 'subsidiary',
            columns: ['internalid', 'country', 'name'],
            filters: [
              ['country', 'is', "BR"], 'AND', ['isinactive', 'is', 'F']
            ]
          });
          //isinactive si se pone T trae todos los inactivos y si es F solo trae los activos

          var searchResult = search_subsidiaria.run().getRange(0, 1000);
          if (searchResult != '' && searchResult != null) {
            for (var i = 0; i < searchResult.length; i++) {
              var id_subsidiria = searchResult[i].getValue('internalid');
              var name_subsidiria = searchResult[i].getValue('name');
              f_subsidiaria.addSelectOption({
                value: id_subsidiria,
                text: name_subsidiria
              });
            }
          }

          var f_bank = form.addField({
            id: 'custpage_bank',
            label: 'BANK',
            type: serverWidget.FieldType.SELECT
          });
          f_bank.isMandatory = true;

          //Busqueda de Subsidiaria por pais de Brasil
          var search_bank = search.create({
            type: 'customrecord_lmry_br_pdf_bank',
            columns: ['internalid', 'name'],
            filters: [
              ['custrecord_lmry_br_active_return_file', 'is', 'T'], 'AND', ['isinactive', 'is', 'F']
            ]
          });
          //isinactive si se pone T trae todos los inactivos y si es F solo trae los activos

          var searchResultBank = search_bank.run().getRange(0, 1000);
          if (searchResultBank != '' && searchResultBank != null) {
            for (var i = 0; i < searchResultBank.length; i++) {
              var id_bank = searchResultBank[i].getValue('internalid');
              var name_bank = searchResultBank[i].getValue('name');
              f_bank.addSelectOption({
                value: id_bank,
                text: name_bank
              });
            }
          }

          var f_file = form.addField({
            id: 'custpage_file',
            label: 'FILE',
            type: serverWidget.FieldType.SELECT
          });
          f_file.isMandatory = true;

          if (Rd_Sub != null && Rd_Sub != '') {
            f_subsidiaria.defaultValue = Rd_Sub;
            f_subsidiaria.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });

            f_bank.defaultValue = Rd_Bank;
            f_bank.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.DISABLED
            });

            var folder = 0;
            var busqueda_config = search.create({
              type: 'customrecord_lmry_br_config_bank_ticket',
              filters: [
                ['custrecord_lmry_name_subsidiary', 'is', Rd_Sub], 'AND', ['custrecord_lmry_pdf_bank', 'is', Rd_Bank]
              ],
              columns: ['custrecord_lmry_folder_return_file', 'custrecord_lmry_br_codigo_ocurrencia']
            });
            busqueda_config = busqueda_config.run().getRange(0, 1);
            if (busqueda_config != null && busqueda_config != '') {
              folder = busqueda_config[0].getValue('custrecord_lmry_folder_return_file');
              var ocurrenciatemp = busqueda_config[0].getValue('custrecord_lmry_br_codigo_ocurrencia');
              ocurrencia = ocurrencia.concat(ocurrenciatemp.split(','));
            }

            if (folder != null && folder != '' && folder != 0) {
              var busqueda_folder = search.create({
                type: 'file',
                filters: [
                  ['folder', 'is', folder]
                ],
                columns: ['internalid', 'name']
              });
              var r_folder = busqueda_folder.run().getRange({
                start: 0,
                end: 100
              });

              if (r_folder != null && r_folder != '') {
                for (var i = 0; i < r_folder.length; i++) {
                  f_file.addSelectOption({
                    value: r_folder[i].getValue('internalid'),
                    text: r_folder[i].getValue('name')
                  });
                }
              }

            }


          }



          var f_sublista = form.addSublist({
            id: 'custpage_sublista',
            label: 'INVOICES',
            type: serverWidget.SublistType.LIST
          });
          f_sublista.addField({
            id: 'id_contador',
            type: serverWidget.FieldType.TEXT,
            label: 'ORDEN'
          });
          f_sublista.addField({
            id: 'id_invoice',
            type: serverWidget.FieldType.TEXT,
            label: 'INTERNAL ID'
          });
          if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
            f_sublista.addField({
              id: 'id_installment',
              type: serverWidget.FieldType.TEXT,
              label: 'INSTALLMENT'
            });
          }
          f_sublista.addField({
            id: 'id_date',
            type: serverWidget.FieldType.TEXT,
            label: 'DATE (DD/MM/AA)'
          });
          f_sublista.addField({
            id: 'id_amount',
            type: serverWidget.FieldType.TEXT,
            label: 'AMOUNT'
          });
          //f_sublista.addField({id:'id_rebateamount',type:serverWidget.FieldType.TEXT,label:'REBATE AMOUNT'});
          f_sublista.addField({
            id: 'id_discountamount',
            type: serverWidget.FieldType.TEXT,
            label: 'DISCOUNT AMOUNT'
          });
          //f_sublista.addField({id:'id_mainamount',type:serverWidget.FieldType.TEXT,label:'MAIN AMOUNT'});
          f_sublista.addField({
            id: 'id_interestamount',
            type: serverWidget.FieldType.TEXT,
            label: 'INTEREST AMOUNT'
          });

          //f_sublista.addField({id:'id_collectionamount',type:serverWidget.FieldType.TEXT,label:'COLLECTION AMOUNT'});
          //f_sublista.addField({id:'id_otheramount',type:serverWidget.FieldType.TEXT,label:'OTHER AMOUNT'});



          log.error('Rd_File', Rd_File);
          if (Rd_File != null && Rd_File != '' && Rd_File != 0) {

            var p_stado = form.addField({
              id: 'id_state',
              label: 'ID Proceso',
              type: serverWidget.FieldType.TEXT,
              container: 'group_pi'
            });
            p_stado.defaultValue = 'PENDIENTE';
            p_stado.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            var search_file = search.create({
              type: 'file',
              columns: ['internalid'],
              filters: [{
                name: 'internalid',
                operator: 'is',
                values: Rd_File
              }]
            });
            var result_file = search_file.run().getRange({
              start: 0,
              end: 1
            });

            if (result_file != null && result_file.length > 0) {
              //var file_invoice = file.load({id:result_file[0].getValue('internalid')});

              switch (Rd_Bank) {
                case '1':
                  setBankBOA(Rd_File, f_sublista, f_file, ocurrencia);
                  break;
                case '2':
                  setBankItau(Rd_File, f_sublista, f_file, ocurrencia);
                  break;
                case '3':
                  setBankBancoDoBrasil(Rd_File, f_sublista, f_file, ocurrencia);
                  break;
                case '4':
                  setBankBradesco(Rd_File, f_sublista, f_file, ocurrencia);
                  break;
                case '5':
                  setBankSantander(Rd_File, f_sublista, f_file, ocurrencia);
                  break;
                case '6':
                  setBankCitibank(Rd_File, f_sublista, f_file, ocurrencia);
                  break;
                default:
                  break;
              }

            }

          }

          if (Rd_Sub != null && Rd_Sub != '') {
            form.addSubmitButton({
              label: 'Process'
            });
          } else {
            form.addSubmitButton({
              label: 'Search invoices'
            });
          }


          form.clientScriptModulePath = './Latam_Library/LMRY_Archivo_Retorno_CLNT_V2.0.js';

          context.response.writePage(form);

        } else {

          var estado = context.request.parameters.id_state;

          if (estado == null || estado == '') {
            redirect.toSuitelet({
              scriptId: 'customscript_lmry_br_archivoretorno_stlt',
              deploymentId: 'customdeploy_lmry_br_archivoretorno_stlt',
              parameters: {
                'custparam_file': context.request.parameters.custpage_file,
                'custparam_subsi': context.request.parameters.custpage_subsidiary,
                'custparam_bank': context.request.parameters.custpage_bank
              }
            });
          } else {

            //LLENADO DE RECORD BR LOG RETURN FILE

            var c_invoices = context.request.getLineCount({
              group: 'custpage_sublista'
            });
            var invoices = [];

            for (var i = 0; i < c_invoices; i++) {
              var id_inv = context.request.getSublistValue({
                group: 'custpage_sublista',
                name: 'id_invoice',
                line: i
              });
              var id_installment = '0';
              if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
                var instvalue = context.request.getSublistValue({
                  group: 'custpage_sublista',
                  name: 'id_installment',
                  line: i
                });
                if (instvalue) {
                  id_installment = instvalue;
                }
              }
              var id_amount = context.request.getSublistValue({
                group: 'custpage_sublista',
                name: 'id_amount',
                line: i
              });
              var id_interest = context.request.getSublistValue({
                group: 'custpage_sublista',
                name: 'id_interestamount',
                line: i
              });
              var id_discount = context.request.getSublistValue({
                group: 'custpage_sublista',
                name: 'id_discountamount',
                line: i
              });
              var id_date = context.request.getSublistValue({
                group: 'custpage_sublista',
                name: 'id_date',
                line: i
              });
              id_date = id_date.substring(0, 2) + id_date.substring(3, 5) + id_date.substring(6, 8)

              invoices.push(id_inv + ";" + id_installment + ";" + id_amount + ";" + id_interest + ";" + id_discount + ";" + id_date);

            }

            var a_file = context.request.parameters.custpage_file;
            var a_subsi = context.request.parameters.custpage_subsidiary;
            var a_bank = context.request.parameters.custpage_bank;

            var r_log = record.create({
              type: 'customrecord_lmry_br_log_return_file'
            });

            r_log.setValue({
              fieldId: 'custrecord_lmry_br_log_return_file',
              value: a_file
            });
            r_log.setValue({
              fieldId: 'custrecord_lmry_br_log_return_invoice',
              value: invoices.join('|')
            });
            r_log.setValue({
              fieldId: 'custrecord_lmry_br_log_return_subsidiary',
              value: a_subsi
            });
            r_log.setValue({
              fieldId: 'custrecord_lmry_br_log_return_bank',
              value: a_bank
            });

            var id_return = r_log.save();
            var usuario = runtime.getCurrentUser().id;

            var params = {};
            params['custscript_lmry_br_return_state'] = id_return;
            params['custscript_lmry_br_return_user'] = usuario;

            var redi_mapr = task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: 'customscript_lmry_br_archivoretorno_mprd',
              deploymentId: 'customdeploy_lmry_br_archivoretorno_mprd',
              params: params
            });
            redi_mapr.submit();

            redirect.toSuitelet({
              scriptId: 'customscript_lmry_br_archivo_log_stlt',
              deploymentId: 'customdeploy_lmry_br_archivo_log_stlt'
            });
          }

        }


      } catch (err) {
        library_email.sendemail('[ onRequest ]' + err, LMRY_script);
        log.error('Error', err);
      }

    }

    function setBankBOA(Rd_File, f_sublista, f_file, ocurrencia) {
      var file_invoice = file.load({
        id: Rd_File
      });

      f_file.defaultValue = Rd_File;
      f_file.updateDisplayType({
        displayType: serverWidget.FieldDisplayType.DISABLED
      });

      //log.error('file_invoice',file_invoice.getContents());

      var iterator = file_invoice.lines.iterator();

      var a_detalle = [];
      var p_header = [0, 1, 2, 9, 11, 19, 21, 26, 38, 50, 76, 79, 104, 108, 120, 124, 130, 394, 400];
      var p_detalle = [0, 1, 3, 17, 29, 37, 62, 74, 86, 106, 108, 110, 116, 126, 146, 152, 165, 168, 173, 175, 188, 227, 240, 253, 266, 279, 292, 295, 301, 365, 377, 393, 394, 400];
      var p_trailer = [0, 1, 2, 16, 22, 36, 42, 394, 400];
      var contador = 0, c2 = 0;
      var header = '';
      var trailer = '';

      //iterator.each(function () {return false;});
      iterator.each(function(line) {
        contador++;
        return true;
      });

      var iterator = file_invoice.lines.iterator();

      iterator.each(function(line) {
        //lineValues = lineValues.replace(/ /g, "");
        var lineValues = line.value;
        var s_invoice = '';

        if (c2 == 0) {
          for (var i = 0; i < p_header.length - 1; i++) {
            header += lineValues.substring(p_header[i], p_header[i + 1]) + "|";
          }
        } else if (c2 < contador - 1) {
          for (var i = 0; i < p_detalle.length - 1; i++) {
            s_invoice += lineValues.substring(p_detalle[i], p_detalle[i + 1]) + "|";
          }
          a_detalle.push(s_invoice);
        } else {
          for (var i = 0; i < p_trailer.length - 1; i++) {
            trailer += lineValues.substring(p_trailer[i], p_trailer[i + 1]) + "|";
          }
        }

        c2++;

        return true;

      });

      log.error('header', header);
      log.error('a_detalle', a_detalle);
      log.error('trailer', trailer);


      var k = 0;
      for (var j = 0; j < a_detalle.length; j++) {
        var aux_detalle = a_detalle[j].split('|');

        if (ocurrencia.indexOf(aux_detalle[10]) != -1) {
          f_sublista.setSublistValue({
            id: 'id_contador',
            line: k,
            value: (k + 1).toFixed(0)
          });
          //INTERNALID DEL INVOICE
          var idinvoice = aux_detalle[5].replace(/\b0+/g, "").replace(/ /g, "");
          f_sublista.setSublistValue({
            id: 'id_invoice',
            line: k,
            value: idinvoice.split('_')[0]
          });
          if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
            if (idinvoice.split('_').length - 1) {
              f_sublista.setSublistValue({
                id: 'id_installment',
                line: k,
                value: idinvoice.split('_')[1]
              });
            }
          }

          //15 AMOUNT DEL INVOICE
          var amount = (parseFloat(aux_detalle[15].replace(/\b0+/g, '')) / 100).toFixed(2);
          f_sublista.setSublistValue({
            id: 'id_amount',
            line: k,
            value: amount
          });

          var discountamount = aux_detalle[22].replace(/\b0+/g, '');
          if (discountamount == '') {
            discountamount = '0.00';
          } else {
            discountamount = (parseFloat(discountamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_discountamount',
            line: k,
            value: discountamount
          });

          var interestamount = aux_detalle[24].replace(/\b0+/g, '');
          if (interestamount == '') {
            interestamount = '0.00';
          } else {
            interestamount = (parseFloat(interestamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_interestamount',
            line: k,
            value: interestamount
          });

          var dateOcurrencia = aux_detalle[11];
          var dateday = dateOcurrencia.substring(0, 2);
          var datemon = dateOcurrencia.substring(2, 4);
          var dateyear = dateOcurrencia.substring(4, 6);
          f_sublista.setSublistValue({
            id: 'id_date',
            line: k,
            value: dateday + '/' + datemon + '/' + dateyear
          });

          k++;
        }

      }
    }

    function setBankCitibank(Rd_File, f_sublista, f_file, ocurrencia) {
      var file_invoice = file.load({
        id: Rd_File
      });

      f_file.defaultValue = Rd_File;
      f_file.updateDisplayType({
        displayType: serverWidget.FieldDisplayType.DISABLED
      });

      //log.error('file_invoice',file_invoice.getContents());

      var iterator = file_invoice.lines.iterator();

      var a_detalle = [];
      var p_header = [0, 1, 2, 9, 11, 26, 46, 76, 79, 94, 100, 105, 108, 114, 117, 119, 125, 394, 400];
      var p_detalle = [0, 1, 3, 17, 37, 62, 64, 76, 82, 107, 108, 110, 116, 126, 128, 140, 146, 152, 165, 168, 173, 175, 188, 201, 214, 227, 240, 253, 266, 279, 295, 301, 321, 334, 337, 385, 391, 394, 400];
      var p_trailer = [0, 1, 4, 7, 17, 25, 39, 394, 400];
      var contador = 0,
        c2 = 0;
      var header = '';
      var trailer = '';

      //iterator.each(function () {return false;});
      iterator.each(function(line) {
        contador++;
        return true;
      });

      var iterator = file_invoice.lines.iterator();

      iterator.each(function(line) {
        //lineValues = lineValues.replace(/ /g, "");
        var lineValues = line.value;
        var s_invoice = '';

        if (c2 == 0) {
          for (var i = 0; i < p_header.length - 1; i++) {
            header += lineValues.substring(p_header[i], p_header[i + 1]) + "|";
          }
        } else if (c2 < contador - 1) {
          for (var i = 0; i < p_detalle.length - 1; i++) {
            s_invoice += lineValues.substring(p_detalle[i], p_detalle[i + 1]) + "|";
          }
          a_detalle.push(s_invoice);
        } else {
          for (var i = 0; i < p_trailer.length - 1; i++) {
            trailer += lineValues.substring(p_trailer[i], p_trailer[i + 1]) + "|";
          }
        }

        c2++;

        return true;

      });

      log.error('header', header);
      log.error('a_detalle', a_detalle);
      log.error('trailer', trailer);

      /*for(var i=0;i<a_detalle.length;i++){
        log.error('a_detalle '+i,a_detalle[i]);
      }*/

      var k = 0;
      for (var j = 0; j < a_detalle.length; j++) {
        var aux_detalle = a_detalle[j].split('|');

        if (ocurrencia.indexOf(aux_detalle[10]) != -1) {
          f_sublista.setSublistValue({
            id: 'id_contador',
            line: k,
            value: (k + 1).toFixed(0)
          });
          //INTERNALID DEL INVOICE (38-62)
          var idinvoice = aux_detalle[4].replace(/\b0+/g, "").replace(/ /g, "");
          f_sublista.setSublistValue({
            id: 'id_invoice',
            line: k,
            value: idinvoice.split('_')[0]
          });
          if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
            if (idinvoice.split('_').length - 1) {
              f_sublista.setSublistValue({
                id: 'id_installment',
                line: k,
                value: idinvoice.split('_')[1]
              });
            }
          }

          //17 AMOUNT DEL INVOICE (152-165)
          var amount = (parseFloat(aux_detalle[17].replace(/\b0+/g, '')) / 100).toFixed(2);
          f_sublista.setSublistValue({
            id: 'id_amount',
            line: k,
            value: amount
          });

          //26 DISCOUNT (240-253)
          var discountamount = aux_detalle[26].replace(/\b0+/g, '');
          if (discountamount == '') {
            discountamount = '0.00';
          } else {
            discountamount = (parseFloat(discountamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_discountamount',
            line: k,
            value: discountamount
          });

          //28 JUROS (266-279)
          var interestamount = aux_detalle[28].replace(/\b0+/g, '');
          if (interestamount == '') {
            interestamount = '0.00';
          } else {
            interestamount = (parseFloat(interestamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_interestamount',
            line: k,
            value: interestamount
          });

          //11 DATA OCURRENCIA (110-116)
          var dateOcurrencia = aux_detalle[11];
          var dateday = dateOcurrencia.substring(0, 2);
          var datemon = dateOcurrencia.substring(2, 4);
          var dateyear = dateOcurrencia.substring(4, 6);
          f_sublista.setSublistValue({
            id: 'id_date',
            line: k,
            value: dateday + '/' + datemon + '/' + dateyear
          });

          k++;
        }

      }
    }

    function setBankItau(Rd_File, f_sublista, f_file, ocurrencia) {

      var file_invoice = file.load({
        id: Rd_File
      });

      f_file.defaultValue = Rd_File;
      f_file.updateDisplayType({
        displayType: serverWidget.FieldDisplayType.DISABLED
      });

      var iterator = file_invoice.lines.iterator();

      var a_detalle = [];
      var p_header = [0, 1, 2, 9, 11, 26, 30, 32, 37, 38, 46, 76, 79, 94, 100, 105, 108, 113, 119, 394, 400];
      var p_detalle = [0, 1, 3, 21, 23, 28, 29, 37, 62, 70, 82, 85, 93, 94, 107, 108, 110, 116, 126, 128, 134, 146, 152, 165, 168, 172, 173, 175, 188, 214, 227, 240, 253, 266, 279, 292, 293, 295, 301, 305, 311, 324, 354, 377, 385, 392, 394, 400];
      var p_trailer = [0, 1, 2, 4, 7, 17, 25, 39, 47, 57, 65, 79, 87, 177, 185, 199, 207, 212, 220, 234, 394, 400];
      var contador = 0,
        c2 = 0;
      var header = '';
      var trailer = '';

      iterator.each(function(line) {
        contador++;
        return true;
      });

      var iterator = file_invoice.lines.iterator();

      iterator.each(function(line) {

        //lineValues = lineValues.replace(/ /g, "");
        var lineValues = line.value;
        var s_invoice = '';

        if (c2 == 0) {
          for (var i = 0; i < p_header.length - 1; i++) {
            header += lineValues.substring(p_header[i], p_header[i + 1]) + "|";
          }
        } else if (c2 < contador - 1) {
          for (var i = 0; i < p_detalle.length - 1; i++) {
            s_invoice += lineValues.substring(p_detalle[i], p_detalle[i + 1]) + "|";
          }
          a_detalle.push(s_invoice);
        } else {
          for (var i = 0; i < p_trailer.length - 1; i++) {
            trailer += lineValues.substring(p_trailer[i], p_trailer[i + 1]) + "|";
          }
        }

        c2++;

        return true;

      });

      log.error('header Itau', header);
      log.error('detalle Itau', a_detalle);
      log.error('trailer Itau', trailer);

      var k = 0;
      //LLENADO DE SUBLISTA
      for (var j = 0; j < a_detalle.length; j++) {
        var aux_detalle = a_detalle[j].split('|');

        if (ocurrencia.indexOf(aux_detalle[15]) != -1) {
          f_sublista.setSublistValue({
            id: 'id_contador',
            line: k,
            value: (k + 1).toFixed(0)
          });
          //INTERNALID DEL INVOICE (38-62)
          var idinvoice = aux_detalle[7].replace(/\b0+/g, "").replace(/ /g, "");
          f_sublista.setSublistValue({
            id: 'id_invoice',
            line: k,
            value: idinvoice.split('_')[0]
          });
          if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
            if (idinvoice.split('_').length - 1) {
              f_sublista.setSublistValue({
                id: 'id_installment',
                line: k,
                value: idinvoice.split('_')[1]
              });
            }
          }

          //17 AMOUNT DEL INVOICE (153-165)
          var amount = (parseFloat(aux_detalle[22].replace(/\b0+/g, '')) / 100).toFixed(2);
          f_sublista.setSublistValue({
            id: 'id_amount',
            line: k,
            value: amount
          });

          //26 DISCOUNT (241-253)
          var discountamount = aux_detalle[31].replace(/\b0+/g, '');
          if (discountamount == '') {
            discountamount = '0.00';
          } else {
            discountamount = (parseFloat(discountamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_discountamount',
            line: k,
            value: discountamount
          });

          //28 JUROS (267-279)
          var interestamount = aux_detalle[33].replace(/\b0+/g, '');
          if (interestamount == '') {
            interestamount = '0.00';
          } else {
            interestamount = (parseFloat(interestamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_interestamount',
            line: k,
            value: interestamount
          });

          //Data Credito (296-301)
          var dateOcurrencia = aux_detalle[37];
          var dateday = dateOcurrencia.substring(0, 2);
          var datemon = dateOcurrencia.substring(2, 4);
          var dateyear = dateOcurrencia.substring(4, 6);
          f_sublista.setSublistValue({
            id: 'id_date',
            line: k,
            value: dateday + '/' + datemon + '/' + dateyear
          });

          k++;
        }

      }

    }

    function setBankSantander(Rd_File, f_sublista, f_file, ocurrencia) {
      var file_invoice = file.load({
        id: Rd_File
      });

      f_file.defaultValue = Rd_File;
      f_file.updateDisplayType({
        displayType: serverWidget.FieldDisplayType.DISABLED
      });

      //log.error('file_invoice',file_invoice.getContents());

      var iterator = file_invoice.lines.iterator();

      var a_detalle = [];
      var p_header = [0, 1, 2, 9, 11, 26, 30, 38, 46, 76, 79, 94, 100, 108, 117, 385, 389, 391, 394, 400];
      var p_detalle = [0, 1, 3, 17, 21, 29, 37, 62, 70, 107, 108, 110, 116, 126, 134, 136, 139, 142, 145, 146, 152, 165, 168, 173, 175, 188, 201, 214, 227, 240, 253, 266, 279, 292, 293, 294, 295, 301, 337, 338, 340, 353, 366, 379, 380, 383, 385, 389, 391, 394, 400];
      var p_trailer = [0, 1, 2, 4, 7, 17, 25, 39, 47, 97, 105, 119, 127, 137, 145, 159, 167, 391, 394, 400];
      var contador = 0,
        c2 = 0;
      var header = '';
      var trailer = '';

      //iterator.each(function () {return false;});
      iterator.each(function(line) {
        contador++;
        return true;
      });

      var iterator = file_invoice.lines.iterator();

      iterator.each(function(line) {
        //lineValues = lineValues.replace(/ /g, "");
        var lineValues = line.value;
        var s_invoice = '';

        if (c2 == 0) {
          for (var i = 0; i < p_header.length - 1; i++) {
            header += lineValues.substring(p_header[i], p_header[i + 1]) + "|";
          }
        } else if (c2 < contador - 1) {
          for (var i = 0; i < p_detalle.length - 1; i++) {
            s_invoice += lineValues.substring(p_detalle[i], p_detalle[i + 1]) + "|";
          }
          a_detalle.push(s_invoice);
        } else {
          for (var i = 0; i < p_trailer.length - 1; i++) {
            trailer += lineValues.substring(p_trailer[i], p_trailer[i + 1]) + "|";
          }
        }

        c2++;

        return true;

      });

      log.error('header', header);
      log.error('a_detalle', a_detalle);
      log.error('trailer', trailer);


      var k = 0;
      for (var j = 0; j < a_detalle.length; j++) {
        var aux_detalle = a_detalle[j].split('|');

        if (ocurrencia.indexOf(aux_detalle[10]) != -1) {
          f_sublista.setSublistValue({
            id: 'id_contador',
            line: k,
            value: (k + 1).toFixed(0)
          });
          //INTERNALID DEL INVOICE (38-62)
          var idinvoice = aux_detalle[6].replace(/\b0+/g, "").replace(/ /g, "");
          f_sublista.setSublistValue({
            id: 'id_invoice',
            line: k,
            value: idinvoice.split('_')[0]
          });
          if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
            if (idinvoice.split('_').length - 1) {
              f_sublista.setSublistValue({
                id: 'id_installment',
                line: k,
                value: idinvoice.split('_')[1]
              });
            }
          }

          //20 AMOUNT DEL INVOICE (152, 165)
          var amount = (parseFloat(aux_detalle[20].replace(/\b0+/g, '')) / 100).toFixed(2);
          f_sublista.setSublistValue({
            id: 'id_amount',
            line: k,
            value: amount
          });

          //29 Desconto (240, 253)
          var discountamount = aux_detalle[29].replace(/\b0+/g, '');
          if (discountamount == '') {
            discountamount = '0.00';
          } else {
            discountamount = (parseFloat(discountamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_discountamount',
            line: k,
            value: discountamount
          });

          //31 JUROS (266, 279)
          var interestamount = aux_detalle[31].replace(/\b0+/g, '');
          if (interestamount == '') {
            interestamount = '0.00';
          } else {
            interestamount = (parseFloat(interestamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_interestamount',
            line: k,
            value: interestamount
          });

          var dateOcurrencia = aux_detalle[11];
          var dateday = dateOcurrencia.substring(0, 2);
          var datemon = dateOcurrencia.substring(2, 4);
          var dateyear = dateOcurrencia.substring(4, 6);
          f_sublista.setSublistValue({
            id: 'id_date',
            line: k,
            value: dateday + '/' + datemon + '/' + dateyear
          });

          k++;
        }

      }
    }

    function setBankBancoDoBrasil(Rd_File, f_sublista, f_file, ocurrencia) {
      var file_invoice = file.load({
        id: Rd_File
      });

      f_file.defaultValue = Rd_File;
      f_file.updateDisplayType({
        displayType: serverWidget.FieldDisplayType.DISABLED
      });

      //log.error('file_invoice',file_invoice.getContents());

      var iterator = file_invoice.lines.iterator();

      var a_detalle = [];
      var p_header = [0, 1, 2, 9, 11, 19, 26, 30, 31, 39, 40, 46, 76, 94, 100, 107, 149, 156, 394, 400];
      var p_detalle = [0, 1, 3, 17, 21, 22, 30, 31, 38, 63, 80, 81, 82, 86, 88, 91, 94, 95, 100, 105, 106, 108, 110, 116, 126, 146, 152, 165, 168, 172, 173, 175, 181, 188, 201, 214, 227, 240, 253, 266, 279, 292, 305, 318, 319, 320, 332, 333, 342, 349, 358, 365, 374, 381, 390, 391, 392, 394, 400];
      var p_trailer = [0, 1, 2, 4, 7, 17, 25, 39, 47, 57, 65, 79, 87, 97, 105, 119, 127, 137, 145, 159, 167, 217, 225, 239, 247, 394, 400];
      var contador = 0,
        c2 = 0;
      var header = '';
      var trailer = '';

      //iterator.each(function () {return false;});
      iterator.each(function(line) {
        contador++;
        return true;
      });

      var iterator = file_invoice.lines.iterator();

      iterator.each(function(line) {
        //lineValues = lineValues.replace(/ /g, "");
        var lineValues = line.value;
        var s_invoice = '';

        if (c2 == 0) {
          for (var i = 0; i < p_header.length - 1; i++) {
            header += lineValues.substring(p_header[i], p_header[i + 1]) + "|";
          }
        } else if (c2 < contador - 1) {
          for (var i = 0; i < p_detalle.length - 1; i++) {
            s_invoice += lineValues.substring(p_detalle[i], p_detalle[i + 1]) + "|";
          }
          a_detalle.push(s_invoice);
        } else {
          for (var i = 0; i < p_trailer.length - 1; i++) {
            trailer += lineValues.substring(p_trailer[i], p_trailer[i + 1]) + "|";
          }
        }

        c2++;

        return true;

      });

      log.error('header', header);
      log.error('a_detalle', a_detalle);
      log.error('trailer', trailer);

      /*for(var i=0;i<a_detalle.length;i++){
        log.error('a_detalle '+i,a_detalle[i]);
      }*/

      var k = 0;
      for (var j = 0; j < a_detalle.length; j++) {
        var aux_detalle = a_detalle[j].split('|');

        if (ocurrencia.indexOf(aux_detalle[21]) != -1) {
          f_sublista.setSublistValue({
            id: 'id_contador',
            line: k,
            value: (k + 1).toFixed(0)
          });
          //INTERNALID DEL INVOICE (82-107)
          var idinvoice = aux_detalle[8].replace(/\b0+/g, "").replace(/ /g, "");
          f_sublista.setSublistValue({
            id: 'id_invoice',
            line: k,
            value: idinvoice.split('_')[0]
          });
          if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
            if (idinvoice.split('_').length - 1) {
              f_sublista.setSublistValue({
                id: 'id_installment',
                line: k,
                value: idinvoice.split('_')[1]
              });
            }
          }

          //26 AMOUNT DEL INVOICE (152-165)
          var amount = (parseFloat(aux_detalle[26].replace(/\b0+/g, '')) / 100).toFixed(2);
          f_sublista.setSublistValue({
            id: 'id_amount',
            line: k,
            value: amount
          });

          //37 DISCOUNT (240-253)
          var discountamount = aux_detalle[37].replace(/\b0+/g, '');
          if (discountamount == '') {
            discountamount = '0.00';
          } else {
            discountamount = (parseFloat(discountamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_discountamount',
            line: k,
            value: discountamount
          });

          //39 JUROS (266-279)
          var interestamount = aux_detalle[39].replace(/\b0+/g, '');
          if (interestamount == '') {
            interestamount = '0.00';
          } else {
            interestamount = (parseFloat(interestamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_interestamount',
            line: k,
            value: interestamount
          });

          //22 DATA OCURRENCIA (110-116)
          var dateOcurrencia = aux_detalle[22];
          var dateday = dateOcurrencia.substring(0, 2);
          var datemon = dateOcurrencia.substring(2, 4);
          var dateyear = dateOcurrencia.substring(4, 6);
          f_sublista.setSublistValue({
            id: 'id_date',
            line: k,
            value: dateday + '/' + datemon + '/' + dateyear
          });

          k++;
        }

      }
    }

    function setBankBradesco(Rd_File, f_sublista, f_file, ocurrencia) {
      var file_invoice = file.load({
        id: Rd_File
      });

      f_file.defaultValue = Rd_File;
      f_file.updateDisplayType({
        displayType: serverWidget.FieldDisplayType.DISABLED
      });

      //log.error('file_invoice',file_invoice.getContents());

      var iterator = file_invoice.lines.iterator();

      var a_detalle = [];
      var p_header = [0, 1, 2, 9, 11, 26, 46, 76, 79, 94, 100, 108, 113, 379, 385, 394, 400];
      var p_detalle = [0, 1, 3, 17, 20, 37, 62, 70, 82, 92, 104, 105, 107, 108, 110, 116, 126, 146, 152, 165, 168, 173, 175, 188, 201, 214, 227, 240, 253, 266, 279, 292, 294, 295, 301, 304, 314, 318, 328, 368, 370, 380, 394, 400];
      var p_trailer = [0, 1, 2, 4, 7, 17, 25, 39, 47, 57, 62, 74, 86, 91, 103, 108, 120, 125, 137, 142, 154, 159, 171, 176, 188, 362, 377, 385, 394, 400];
      var contador = 0,
        c2 = 0;
      var header = '';
      var trailer = '';

      //iterator.each(function () {return false;});
      iterator.each(function(line) {
        contador++;
        return true;
      });

      var iterator = file_invoice.lines.iterator();

      iterator.each(function(line) {
        //lineValues = lineValues.replace(/ /g, "");
        var lineValues = line.value;
        var s_invoice = '';

        if (c2 == 0) {
          for (var i = 0; i < p_header.length - 1; i++) {
            header += lineValues.substring(p_header[i], p_header[i + 1]) + "|";
          }
        } else if (c2 < contador - 1) {
          for (var i = 0; i < p_detalle.length - 1; i++) {
            s_invoice += lineValues.substring(p_detalle[i], p_detalle[i + 1]) + "|";
          }
          a_detalle.push(s_invoice);
        } else {
          for (var i = 0; i < p_trailer.length - 1; i++) {
            trailer += lineValues.substring(p_trailer[i], p_trailer[i + 1]) + "|";
          }
        }

        c2++;

        return true;

      });

      log.error('header', header);
      log.error('a_detalle', a_detalle);
      log.error('trailer', trailer);

      /*for(var i=0;i<a_detalle.length;i++){
        log.error('a_detalle '+i,a_detalle[i]);
      }*/

      var k = 0;
      for (var j = 0; j < a_detalle.length; j++) {
        var aux_detalle = a_detalle[j].split('|');

        if (ocurrencia.indexOf(aux_detalle[13]) != -1) {
          f_sublista.setSublistValue({
            id: 'id_contador',
            line: k,
            value: (k + 1).toFixed(0)
          });
          //INTERNALID DEL INVOICE (37,62)
          var idinvoice = aux_detalle[5].replace(/\b0+/g, "").replace(/ /g, "");
          f_sublista.setSublistValue({
            id: 'id_invoice',
            line: k,
            value: idinvoice.split('_')[0]
          });
          if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == 'T') {
            if (idinvoice.split('_').length - 1) {
              f_sublista.setSublistValue({
                id: 'id_installment',
                line: k,
                value: idinvoice.split('_')[1]
              });
            }
          }

          //18 AMOUNT DEL INVOICE (152-165)
          var amount = (parseFloat(aux_detalle[18].replace(/\b0+/g, '')) / 100).toFixed(2);
          f_sublista.setSublistValue({
            id: 'id_amount',
            line: k,
            value: amount
          });

          //27 DISCOUNT (240-253)
          var discountamount = aux_detalle[27].replace(/\b0+/g, '');
          if (discountamount == '') {
            discountamount = '0.00';
          } else {
            discountamount = (parseFloat(discountamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_discountamount',
            line: k,
            value: discountamount
          });

          //29 JUROS (266-279)
          var interestamount = aux_detalle[29].replace(/\b0+/g, '');
          if (interestamount == '') {
            interestamount = '0.00';
          } else {
            interestamount = (parseFloat(interestamount) / 100).toFixed(2);
          }
          f_sublista.setSublistValue({
            id: 'id_interestamount',
            line: k,
            value: interestamount
          });

          //14 DATA OCURRENCIA (110-116)
          var dateOcurrencia = aux_detalle[14];
          var dateday = dateOcurrencia.substring(0, 2);
          var datemon = dateOcurrencia.substring(2, 4);
          var dateyear = dateOcurrencia.substring(4, 6);
          f_sublista.setSublistValue({
            id: 'id_date',
            line: k,
            value: dateday + '/' + datemon + '/' + dateyear
          });

          k++;
        }

      }
    }

    return {
      onRequest: onRequest
    };

  });
