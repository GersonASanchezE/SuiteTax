/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_PurchaseOrderURET_V2.0.js			              ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     16 Ago 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
* @NApiVersion 2.x
* @NScriptType UserEventScript
* @NModuleScope Public
*/

define(['N/format', 'N/runtime', 'N/log', 'N/record', 'N/search', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './Latam_Library/LMRY_HideView3LBRY_V2.0', './WTH_Library/LMRY_BR_GLImpact_Popup_LBRY',
  './WTH_Library/LMRY_TAX_TransactionLBRY_V2.0', './Latam_Library/LMRY_SalesOrderButtonLBRY_V2.0', './WTH_Library/LMRY_ST_Tax_TransactionLBRY_V2.0'],
  function (format, runtime, log, record, search, library_mail, library_HideView, library_GLImpact_Popup, library_latamTax, library_SalesOrder, ST_Tax_Transaction) {

    var LMRY_script = 'LatamReady - Purchase Order URET V2.0';
    var licenses = [];

    var ST_FEATURE = false;

    function beforeLoad(context) {

      ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

      var type = context.type;
      var form = context.form;
      var recordObj = context.newRecord;

      try {
        if (type != 'print' && type != 'email') {
          var subsidiary = recordObj.getValue({ fieldId: 'subsidiary' });

          if (!subsidiary) {
            subsidiary = runtime.getCurrentUser().subsidiary;
          }
          licenses = library_mail.getLicenses(subsidiary);
          if (licenses == null || licenses == '') {
            licenses = [];
            library_HideView.PxHide(form, '', recordObj.type);
            library_HideView.PxHideSubTab(form, '', recordObj.type);
            library_HideView.PxHideColumn(form, '', recordObj.type);
          }

          var LMRY_Result = ValidateAccessPO(subsidiary);
          var country = LMRY_Result[0];
          var hasAccess = LMRY_Result[2];
          hideandViewFields(context, country, hasAccess);

          if (runtime.executionContext == 'USERINTERFACE') {
            //Botón generar Purchase Order
            var id_salesorder = context.request.parameters.salesorder;
            var subsidiary = context.request.parameters.sub;
            if (id_salesorder && subsidiary) {
              library_SalesOrder.obtenerDatosSalesOrder(id_salesorder, subsidiary, recordObj);
            }

            //Suitelet generar Purchase Order
            var estado = context.request.parameters.estado;
            if (estado) {
              library_SalesOrder.obtenerDatosLíneasSalesOrder(estado, recordObj);
            }
          }

          /* * * * * * * * * * * * * * * * * * * * * * * * * * *
           * Fecha : 16 de abril de 2020
           * Se agrego la validacion que la localizacion este
           * activado. library_mail.getAuthorization(140) == true
           * * * * * * * * * * * * * * * * * * * * * * * * * * */
          // HIDE AND VIEW POPUP
          if (country == 'BR' && library_mail.getAuthorization(140, licenses) == true) {
            var pop_cabecera = form.getField('custbody_lmry_br_popup');
            if (library_mail.getAuthorization(432, licenses) == false) {

              // CustBody - Valida si existe campo
              if (pop_cabecera != '' && pop_cabecera != null) {
                pop_cabecera.updateDisplayType({ displayType: 'hidden' });
              }

              var sublist_item = form.getSublist('item');
              var pop_columna = sublist_item.getField({ id: 'custcol_lmry_br_popup' });

              // CustCol - Valida si el JSON esta lleno
              if (typeof (pop_columna) == 'object') {
                // CustCol - Valida si el JSON esta lleno
                if (JSON.stringify(pop_columna) != '{}') {
                  pop_columna.updateDisplayType({ displayType: 'hidden' });
                } // Fin - CustCol - Valida si el JSON esta lleno
              }
            } else {
              var id_br = recordObj.id;
              // YA ESTA CREADA LA PO
              if (id_br != null && id_br != '' && id_br != undefined) {
                // Custom Record : LatamReady - BR Transaction Fields
                var search_br = search.create({ type: 'customrecord_lmry_br_transaction_fields', filters: [{ name: 'custrecord_lmry_br_related_transaction', operator: 'is', values: id_br }] });
                search_br = search_br.run().getRange({ start: 0, end: 1 });

                if (search_br != null && search_br.length > 0) {
                  // CustBody - Valida si existe campo
                  if (pop_cabecera != '' && pop_cabecera != null) {
                    pop_cabecera.updateDisplayType({ displayType: 'hidden' });
                  }
                }
              } // Fin - YA ESTA CREADA LA PO
            }

            // Solo en el evento Type Copy
            if (type == 'copy') {
              // CustBody - Valida si existe campo
              var json_cabecera = form.getField('custbody_lmry_br_json');
              if (json_cabecera != '' && json_cabecera != null) {
                recordObj.setValue('custbody_lmry_br_json', '');

                var sublist_item = form.getSublist('item');
                var json_columna = sublist_item.getField({ id: 'custcol_lmry_br_json' });
                // Valida si es Objeto
                if (typeof (json_columna) == 'object') {
                  // CustCol - Valida si el JSON esta lleno
                  if (JSON.stringify(json_columna) != '{}') {
                    // Limpia la columna JSON
                    for (var i = 0; i < recordObj.getLineCount({ sublistId: 'item' }); i++) {
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_json', line: i, value: '' });
                    }
                  } // Fin - CustCol - Valida si el JSON esta lleno
                } // Fin - Valida si es Objeto
              }
            } // Fin - Type Copy
          } // Fin - HIDE AND VIEW POPUP

          if (country == 'BR') {
            if (type == 'copy' || type == 'xcopy') {
              if (ST_FEATURE === true || ST_FEATURE === "T") {
                ST_Tax_Transaction.cleanLinesforCopy(recordObj, licenses);
              } else {
                library_latamTax.cleanLinesforCopy(recordObj, licenses);
              }
            }
          }

          //Pedimentos
          if (country == 'MX') {
            var recordID = recordObj.id;
            if (type == 'view' && searchPediments(recordID)) {
              form.removeButton('edit');
            }
          }

        }
      }
      catch (err) {
        library_mail.sendemail2(' [ BeforeLoad ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
      }
    }

    function beforeSubmit(context) {
      var recordObj = context.newRecord;
      try {
        var subsidiary = recordObj.getValue('subsidiary');
        var LMRY_Result = ValidateAccessPO(subsidiary);

        if (LMRY_Result[0] == "BR") {
          if (["create", "edit", "copy"].indexOf(context.type) != -1) {
            if (context.type == 'edit') {
              cleanLinesforCopy(recordObj);
            }
          }
        }
      }
      catch (err) {
        library_mail.sendemail2(' [ BeforeLoad ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
      }
    }

    function afterSubmit(context) {

      try {

        var recordObj = context.newRecord;
        var type = context.type;
        var LMRY_Intern = recordObj.id;
        var subsidiary = recordObj.getValue('subsidiary');

        licenses = library_mail.getLicenses(subsidiary);

        var LMRY_Result = ValidateAccessPO(subsidiary);

        var featurePopup = library_mail.getAuthorization(432, licenses);

        if (featurePopup == true && LMRY_Result[0] == 'BR' && (type == 'copy' || type == 'create' || type == 'edit')) {

          /* * * * * * * * * * * * * * * * * * * * * * * * * * *
           * Fecha : 16 de abril de 2020
           * LatamReady - BR Transaction Fields
           * customrecord_lmry_br_transaction_fields
           * * * * * * * * * * * * * * * * * * * * * * * * * * */
          var search_br = search.create({ type: 'customrecord_lmry_br_transaction_fields', columns: ['internalid'], filters: [{ name: 'custrecord_lmry_br_related_transaction', operator: 'anyof', values: recordObj.id }] });
          var result_br = search_br.run().getRange({ start: 0, end: 1 });

          var loadPO = record.load({ type: 'purchaseorder', id: recordObj.id });

          if (result_br.length == 0) {
            creacionRecords(loadPO, true, '');
          } else {
            creacionRecords(loadPO, false, result_br[0].getValue('internalid'));
          }

        }

        //GL IMPACT POPUP
        if ((type == 'create' || type == 'edit') && LMRY_Result[0] == 'BR' && featurePopup == true) {
          library_GLImpact_Popup.afterSubmit_GLpopup(context);
        }

        if (type == 'edit' && LMRY_Result[0] == 'BR' && library_mail.getAuthorization(527, licenses)) {
          record.submitFields({
            type: 'purchaseorder',
            id: LMRY_Intern,
            values: {
              'custbody_lmry_scheduled_process': false,
            },
            options: {
              disableTriggers: true
            }
          });

          library_latamTax.deleteTaxResults(recordObj);
        }


      } catch (err) {
        library_mail.sendemail2(' [ afterSubmit ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
      }

    }

    function hideandViewFields(context, country, hasAccess) {
      try {
        var type = context.type;
        var recordObj = context.newRecord;
        var form = context.form;
        var typeTrans = recordObj.type;
        if (form) {
          var types = ['create', 'edit', 'copy', 'view'];
          if (types.indexOf(type) != -1) {
            var pcountry = (hasAccess) ? country : '';
            var parameters = [2, 5, 3];
            var functions = ['PxHide', 'PxHideSubTab', 'PxHideColumn'];

            for (var i = 0; i < parameters.length; i++) {
              var isActive = library_mail.getHideView([country], parameters[i], licenses);
              if (isActive) {
                library_HideView[functions[i]](form, pcountry, typeTrans);
              }
            }
          }
        }
      } catch (err) {
        throw ' [ hideandViewFields ] ' + err
      }
    }

    function ValidateAccessPO(idSubsidiary) {
      var LMRY_access = false;
      var LMRY_countr = [];
      var LMRY_Result = [];
      try {
        LMRY_countr = library_mail.Validate_Country(idSubsidiary);

        if (!LMRY_countr.length) {
          LMRY_Result = ['', '-None-', false];
          return LMRY_Result;
        }

        LMRY_access = library_mail.getCountryOfAccess(LMRY_countr, licenses);
        LMRY_Result = [LMRY_countr[0], LMRY_countr[1], LMRY_access];
      }
      catch (err) {
        throw ' [ ValidateAccessPO ] ' + err;
      }

      return LMRY_Result;
    }

    function creacionRecords(recordObj, flagBr, idBr) {

      var idTransaction = recordObj.id;

      //CONCATENADO MULTIBOOKING
      var cadena1 = '', cadena2 = '';
      if (recordObj.getLineCount({ sublistId: 'accountingbookdetail' }) > 0) {
        for (var i = 0; i < recordObj.getLineCount({ sublistId: 'accountingbookdetail' }); i++) {
          cadena1 += recordObj.getSublistValue('accountingbookdetail', 'bookid', i) + "|";
          cadena2 += recordObj.getSublistValue('accountingbookdetail', 'exchangerate', i) + "|";
        }

        cadena1 = cadena1.substring(0, cadena1.length - 1);
        cadena2 = cadena2.substring(0, cadena2.length - 1);

      } else {
        cadena1 = '0';
        cadena2 = recordObj.getValue('exchangerate');
      }

      cadena1 = cadena1 + "&" + cadena2;

      //BR TRANSACTION FIELDS
      if (flagBr) {
        var popup_br = recordObj.getValue('custbody_lmry_br_json');
        if (popup_br != null && popup_br != '' && popup_br != '{}') {
          popup_br = JSON.parse(popup_br);

          /* * * * * * * * * * * * * * * * * * * * * * * * * * *
           * Fecha : 16 de abril de 2020
           * LatamReady - BR Transaction Fields
           * customrecord_lmry_br_transaction_fields
           * * * * * * * * * * * * * * * * * * * * * * * * * * */
          var br_transaction = record.create({ type: 'customrecord_lmry_br_transaction_fields' });

          br_transaction.setValue('custrecord_lmry_br_related_transaction', idTransaction);

          var bandera_br = false;
          for (var i in popup_br) {
            if (popup_br[i][1] != null && popup_br[i][1] != '') {
              if (popup_br[i][2] == 'date') {

                var aux_date = popup_br[i][0];
                /*aux_date = new Date(format.fomat({type:format.Type.DATE, value: popup_br[i][3]}));*/
                //log.error('aux_date con new date',aux_date);
                aux_date = format.parse({ type: format.Type.DATE, value: aux_date });

                br_transaction.setValue(popup_br[i][1], aux_date);
              } else {
                br_transaction.setValue(popup_br[i][1], popup_br[i][0]);
              }
              bandera_br = true;
            }
          }

          if (bandera_br) {
            var id_br_transaction = br_transaction.save({ ignoreMandatoryFields: true, disableTriggers: true });
            //log.error('id_br_transaction', id_br_transaction);
          }

        }
      }

      //ELIMINAR TAX RESULT
      var s_tax_result = search.create({
        type: 'customrecord_lmry_br_transaction', columns: ['internalid'],
        filters: [{ name: 'custrecord_lmry_br_transaction', operator: 'anyof', values: idTransaction },
        { name: 'custrecord_lmry_tax_type', operator: 'anyof', values: ['1', '4'] }, { name: 'custrecord_lmry_total_item', operator: 'isnot', values: 'tax calculator' }]
      });

      var r_tax_result = s_tax_result.run().getRange({ start: 0, end: 1000 });

      if (r_tax_result != null && r_tax_result.length > 0) {
        for (var i = 0; i < r_tax_result.length; i++) {
          var id_taxresult = r_tax_result[i].getValue('internalid');
          var id_tt = record.delete({ type: 'customrecord_lmry_br_transaction', id: id_taxresult });
        }
      }


      //CREAR TAX RESULT
      var impuestos = ['ICMS', 'IPI', 'II', 'PIS', 'COFINS', 'CSLL', 'IRPJ', 'INSS', 'ICMSST'];

      for (var i = 0; i < recordObj.getLineCount('item'); i++) {
        var popup_tax = recordObj.getSublistValue('item', 'custcol_lmry_br_json', i);
        if (popup_tax != null && popup_tax != '' && popup_tax != '{}') {
          popup_tax = JSON.parse(popup_tax);

          for (var j = 0; j < impuestos.length; j++) {
            if (JSON.stringify(popup_tax[impuestos[j]]) != '{}') {
              var tax_result = record.create({ type: 'customrecord_lmry_br_transaction' });

              tax_result.setValue('custrecord_lmry_br_transaction', idTransaction);
              idTransaction = parseFloat(idTransaction);
              idTransaction += "";
              tax_result.setValue('custrecord_lmry_br_related_id', idTransaction);
              tax_result.setValue('custrecord_lmry_br_type', impuestos[j]);
              tax_result.setValue('custrecord_lmry_accounting_books', cadena1);
              tax_result.setValue('custrecord_lmry_tax_type', 4);
              tax_result.setValue('custrecord_lmry_item', recordObj.getSublistValue('item', 'item', i));
              tax_result.setValue('custrecord_lmry_br_positem', i);
              tax_result.setText('custrecord_lmry_br_type_id', impuestos[j]);
              tax_result.setValue('custrecord_lmry_lineuniquekey', recordObj.getSublistValue('item', 'lineuniquekey', i));

              //UN IMPUESTO
              for (var k in popup_tax[impuestos[j]]) {
                if (popup_tax[impuestos[j]][k][1] != null && popup_tax[impuestos[j]][k][1] != '') {

                  if (popup_tax[impuestos[j]][k][1] == 'custrecord_lmry_br_percent') {
                    tax_result.setValue(popup_tax[impuestos[j]][k][1], parseFloat(popup_tax[impuestos[j]][k][0]) / 100);
                  } else {
                    tax_result.setValue(popup_tax[impuestos[j]][k][1], popup_tax[impuestos[j]][k][0]);
                  }

                }
              }

              //CABECERA DE ITEM
              if (popup_tax['body'] != null && popup_tax['body'] != undefined) {
                for (var l in popup_tax['body']) {
                  if (popup_tax['body'][l][1] != null && popup_tax['body'][l][1] != '') {
                    tax_result.setValue(popup_tax['body'][l][1], popup_tax['body'][l][0]);
                  }
                }
              }
              var id_taxresult = tax_result.save({ ignoreMandatoryFields: true, disableTriggers: true });

            }

          }

        }
      } //FIN TAX RESULT

    }

    function searchPediments(obj_ped) {
      try {

        //Busca si la transacción ya se registró en el record LatamReady - MX Pediments Detail
        var search_ped = search.create({ type: 'customrecord_lmry_mx_pedimento_details', filters: [{ name: 'custrecord_lmry_mx_ped_trans_ref', operator: 'is', values: obj_ped }], columns: ['internalid'] });

        var result_ped = search_ped.run().getRange({ start: 0, end: 1 });

        if (result_ped != null && result_ped.length > 0) {
          return true;
        } else {
          return false;
        }

      } catch (err) {
        log.error('searchPediments', err);
        library_mail.sendemail2(' [ searchPediments ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
      }
    }

    function cleanLinesforCopy(RCD_TRANS) {
      try {
        var numLineas = RCD_TRANS.getLineCount({
          sublistId: 'item'
        });

        var featureMultiPrice = runtime.isFeatureInEffect({ feature: 'multprice' });

        RCD_TRANS.setValue({ fieldId: 'custbody_lmry_informacion_adicional', value: '' });

        for (var i = 0; i < numLineas; i++) {

          var isItemTax = RCD_TRANS.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_ar_item_tributo', line: i });
          if (!isItemTax || isItemTax == 'F') {
            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_taxc_rsp', i, '');

            if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_freight_val', line: i })) {
              RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_freight_val', i, '');
            }

            if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_insurance_val', line: i })) {
              RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_insurance_val', i, '');
            }

            if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_expens_val', line: i })) {
              RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_expens_val', i, '');
            }

            var base_amount = RCD_TRANS.getSublistValue('item', 'custcol_lmry_br_base_amount', i); //base_amount es el nuevo net
            if (base_amount) {
              var quantityItem = RCD_TRANS.getSublistValue('item', 'quantity', i);
              quantityItem = parseFloat(quantityItem);
              var rateItem = parseFloat(base_amount) / quantityItem;

              if (featureMultiPrice == true || featureMultiPrice == 'T') {
                RCD_TRANS.setSublistValue('item', 'price', i, -1);
              }
              RCD_TRANS.setSublistValue('item', 'rate', i, round2(rateItem));
              RCD_TRANS.setSublistValue('item', 'amount', i, round2(base_amount));
              RCD_TRANS.setSublistValue('item', 'tax1amt', i, 0);
              RCD_TRANS.setSublistValue('item', 'grossamt', i, round2(base_amount));
              RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_base_amount', i, '');
              RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_total_impuestos', i, '');
            }
          }
        }

        //deleteTaxLines(RCD_TRANS);

      } catch (error) {
        log.error('[cleanLinesforCopy]', error);
      }
      return true;
    }

    function round2(num) {
      return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-14) / 1e2);
    }

    return {
      beforeLoad: beforeLoad,
      beforeSubmit: beforeSubmit,
      afterSubmit: afterSubmit
    }
  });
