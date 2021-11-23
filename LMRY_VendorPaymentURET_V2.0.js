/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_VendorPaymentURET_V2.0.js     				       ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 11 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/transaction', 'N/record', 'N/runtime', 'N/search', 'N/format',
    './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './Latam_Library/LMRY_libWhtPaymentLBRY_V2.0',
    './Latam_Library/LMRY_libDIOTLBRY_V2.0', './Latam_Library/LMRY_HideViewLBRY_V2.0',
    './Latam_Library/LMRY_GLImpact_LBRY_V2.0', './WTH_Library/LMRY_TransferenciaIVA_LBRY_V2.0',
    './Latam_Library/LMRY_Automatic_Installment_LBRY_v2.0', './Latam_Library/LMRY_ST_MX_DIOT_LBRY_V2.0'
  ],

  function(transaction, record, runtime, search, format, library, library1, libraryDIOT, Library_HideView, libraryGLImpact, lbry_traslado_IVA, lbry_installment, ST_Library_DIOT) {

    var LMRY_script = 'LatamReady - Vendor Payment URET V2.0';
    var recordObj = null;
    var form = '';
    var type = '';
    var isURET = true;
    var scriptObj = runtime.getCurrentScript();
    var exchangeCertificado = 1;
    var ST_FEATURE = false;

    //Declaracion de Variables
    var featureLang = runtime.getCurrentScript().getParameter({
      name: 'LANGUAGE'
    });
    featureLang = featureLang.substring(0, 2);

    var valorporc = null;
    var WTHolding = null;
    var valorporcA = null;
    var WTHoldingA = null;
    var valorporcB = null;
    var WTHoldingB = null;
    var correlativo = null;
    var correlativo1 = null;
    var correlativo2 = null;
    var correlativoA = null;
    var correlativoB = null;
    var fechaObtenida = null;
    var auxiliarTieneDosTasas = '00';
    var numeroActual = null;
    var cantDigitos = null;
    var idValorActual = null;
    var montoBaseRetencion = 0;
    /**
     * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
     * @appliedtorecord recordType
     *
     * @param {String} type Operation types: create, edit, view, copy, print, email
     * @param {nlobjForm} form Current form
     * @param {nlobjRequest} request Request object
     * @returns {Void}
     */
    function beforeLoad(context) {
      try {
        var id_bill ='';
        recordObj = context.newRecord;
        type = context.type;
        var typeDoc = recordObj.type;

        var form = context.form;
        form.clientScriptModulePath = './Latam_Library/LMRY_GLImpact_CLNT_V2.0.js';
        var country = new Array();
        country[0] = '';
        country[1] = '';
        var subsidiary = recordObj.getValue({
          fieldId: 'subsidiary'
        });

        licenses = library.getLicenses(subsidiary);

        // Solo al momento de crear
        if (context.type == 'create') {
          try {

            if(runtime.executionContext == 'USERINTERFACE'){
            var id_bill = context.request.parameters.bill;
            }

            if (subsidiary == '' || subsidiary == null) {
              var userS = runtime.getCurrentUser();
              subsidiary = userS.subsidiary;
            }

            if (subsidiary != '' && subsidiary != null) {
              var filters = new Array();
              filters[0] = search.createFilter({
                name: 'internalid',
                operator: search.Operator.ANYOF,
                values: [subsidiary]
              });
              var columns = new Array();
              columns[0] = search.createColumn({
                name: 'country'
              });

              var getfields = search.create({
                type: 'subsidiary',
                columns: columns,
                filters: filters
              });
              getfields = getfields.run().getRange(0, 1000);

              if (getfields != '' && getfields != null) {
                country[0] = getfields[0].getValue('country');
                country[1] = getfields[0].getText('country');
              }
            }
          } catch (err) {

            country[0] = runtime.getCurrentScript().getParameter({
              name: 'custscript_lmry_country_code_stlt'
            });
            country[1] = runtime.getCurrentScript().getParameter({
              name: 'custscript_lmry_country_desc_stlt'
            });
          }

          if (form != '' && form != null) {
            Library_HideView.HideSubTab(form, country[1], recordObj.type, licenses);
          }
        }

        // Diferente de Print and Email
        if (type != 'print' && type != 'email') {
          // Valida que tenga acceso
          var LMRY_Result = ValidateAccess(subsidiary, form, licenses);

          // Solo para Peru
          if (LMRY_Result[0] == 'PE' && recordObj.getValue({
              fieldId: 'custbody_lmry_serie_retencion'
            }) != null) {
            if (library.getAuthorization(1, licenses) == true) {
              onClick(type, form);
            }
          }

          // Solo para Mexico
          if (LMRY_Result[0] == 'MX') {
            // Lista de estado de proceso
            var procesado = recordObj.getValue({
              fieldId: 'custbody_lmry_schedule_transfer_of_iva'
            });
            // Verifica si esta procesado y si esta activo el feature de bloqueo de transaccion
            if (procesado == 1) {
              if (library.getAuthorization(97, licenses)) {
                form.removeButton('edit');
              }
            }
          }
        }
        // Si es nuevo, editado o copiado
        if ((type == 'create' || type == 'edit') &&
          runtime.executionContext == 'USERINTERFACE') {

          // Valida el campo Subsidiary Country


          var valor_Field = recordObj.getValue('custbody_lmry_subsidiary_country');
          var dat_Field = recordObj.getField('custbody_lmry_subsidiary_country');

          if (valor_Field != '') {
            if (dat_Field != null && dat_Field != '') {
              var Field = form.getField('custbody_lmry_subsidiary_country');
              Field.updateDisplayType({
                displayType: 'disabled'
              });
            }
          }
          // Solo al momento de editar
          /*if (type == 'edit') {
            if (LMRY_Result[2]) {
              // Entity
              var entity = form.getField({
                id: 'entity'
              });
              if (entity != null && entity != '') {
                entity.updateDisplayType({
                  displayType: 'disabled'
                });
              }

              // Subsidiary
              var subsidiary = form.getField({
                id: 'subsidiary'
              });
              if (subsidiary != null && subsidiary != '') {
                subsidiary.updateDisplayType({
                  displayType: 'disabled'
                });
              } // Subsidiary
            }

          }*/

          /************************************* MODIFICACIÓN ***********************************************************
             - Fecha: 07/05/2020
             - Descripción: Deshabilita el campo Entity, en caso este activado el feature Disable Entity
          **************************************************************************************************************/

          if (type == 'edit' || (type == 'create' && id_bill != null && id_bill != '')) {
            if (LMRY_Result[2] && library.disableField(typeDoc, LMRY_Result[0], licenses)) {

              var entity = form.getField({
                id: 'entity'
              });

              if (entity != null && entity != '') {
                entity.updateDisplayType({
                  displayType: 'disabled'
                });
              }
              if (type == 'edit') {
                var subsidiaria = form.getField({
                  id: 'subsidiary'
                });

                if (subsidiaria != null && subsidiaria != '') {
                  subsidiaria.updateDisplayType({
                    displayType: 'disabled'
                  });
                }
              }


            }
          }

          // ********************************************FIN MODIFICACIÓN ***********************************************
        }

        if (type == 'view' && runtime.executionContext == 'USERINTERFACE') {
          // Lógica GL Impact
          var btnGl = libraryGLImpact.featureGLImpact(recordObj, 'vendorpayment');
          if (btnGl == 1) {
            if (featureLang == 'es') {
              form.addButton({
                id: 'custpage_id_button_imp',
                label: 'IMPRIMIR GL',
                functionName: 'onclick_event_gl_impact()'
              });
            } else {
              form.addButton({
                id: 'custpage_id_button_imp',
                label: 'PRINT GL',
                functionName: 'onclick_event_gl_impact()'
              });
            }

          }
        }
      } catch (err) {
        recordObj = context.newRecord;
        library.sendemail2(' [ beforeLoad ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }

    }

    /**
     * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
     * @appliedtorecord recordType
     *
     * @param {String} type Operation types: create, edit, delete, xedit
     *                      approve, reject, cancel (SO, ER, Time Bill, PO & RMA only)
     *                      pack, ship (IF)
     *                      markcomplete (Call, Task)
     *                      reassign (Case)
     *                      editforecast (Opp, Estimate)
     * @returns {Void}
     */
    function beforeSubmit(context) {
      try {
        recordObj = context.newRecord;
        type = context.type;
        var form = context.form;
        var subsidiary = recordObj.getValue({
          fieldId: 'subsidiary'
        });

        licenses = library.getLicenses(subsidiary);

        if (type == 'delete') {

          var LMRY_RecoID = recordObj.id;
          var LMRY_Result = ValidateAccess(subsidiary, form, licenses);

          // Solo para Peru - Retenciones
          if (LMRY_Result[0] == 'PE') {
            if (library.getAuthorization(1, licenses) == true) {
              var serieCompr = recordObj.getValue({
                fieldId: 'custbody_lmry_serie_retencion'
              });
              if (serieCompr != null && serieCompr != '') {
                //RECUPERA EL VALOR ACTUAL
                buscaCorrelativo(serieCompr);

                //ELIMINANDO DATOS DEL TIPO DE REGISTRO
                var filters = new Array();
                filters[0] = search.createFilter({
                  name: 'custrecord_lmry_pago_relacionado',
                  operator: search.Operator.ANYOF,
                  values: [LMRY_RecoID]
                });
                filters[1] = search.createFilter({
                  name: 'isinactive',
                  operator: 'is',
                  values: 'F'
                });

                var transacdata = search.create({
                  type: 'customrecord_lmry_comprobante_retencion',
                  columns: ['internalid', 'custrecord_lmry_comp_retencion'],
                  filters: filters
                });

                var transacresult = transacdata.run().getRange(0, 1000);

                /*
                #######################################################
                        MODIFICACACION REALIZADA EL DIA 10-08-2017
                #######################################################
                */
                if (transacresult != null && transacresult != '') {

                  //NUMERO CORRELATIVO A ELIMINAR
                  var numEliminado;

                  for (var cuenta = 0; cuenta < transacresult.length; cuenta++) {
                    var columns = transacresult[cuenta].columns;
                    //numEliminado = nlapiLookupField('customrecord_lmry_comprobante_retencion',transacdata[cuenta].getValue('internalid'),'custrecord_lmry_comp_retencion');
                    numEliminado = parseFloat(transacresult[cuenta].getValue(columns[1]));

                    //ELIMINACION POR EL ID INTERNO DE LA LISTA COMPROB RETENCION
                    var featureRecord = record.delete({
                      type: 'customrecord_lmry_comprobante_retencion',
                      id: transacresult[cuenta].getValue(columns[0])
                    });
                  }

                  //COMPARA SI EL NUMERO DE RETENCION A ELIMINAR ES EL ACTUAL
                  if (numEliminado == numeroActual) {

                    //TRAE LOS VALORES DE LA BUSQUEDA DE LOS ULTIMOS 4 MESES
                    var busqueda = search.load({
                      id: 'customsearch_lmry_ultimas_reten'
                    });
                    var filtersBu = search.createFilter({
                      name: 'custrecord_lmry_serie_retencion',
                      operator: search.Operator.ANYOF,
                      values: [serieCompr]
                    });
                    busqueda.filters.push(filtersBu);
                    /* ********************************************************
                     * 28.04.2020 Validacion para identificar si la busqueda
                     * tiene resultados
                     * old => if (results != null && results.length > 0) {
                     ******************************************************* */
                    var results = busqueda.run().getRange(0, 1000);
                    if (results != null && results != '') {
                      var bandera = true;
                      //ES EL NUEVO VALOR DEL NUMERO CORRELATIVO
                      var numeroCorrelativo;

                      //COMPARA ITERATIVAMENTE HASTA ENCONTRAR EL 1ER DISTINTO
                      for (var i = 0; bandera && i < results.length; i++) {
                        numeroCorrelativo = parseFloat(results[i].getValue('custrecord_lmry_comp_retencion'));
                        if (numeroCorrelativo != numEliminado) {
                          bandera = false;
                        }
                      }

                      var registroAux = record.load({
                        type: 'customrecord_lmry_serie_compro_retencion',
                        id: idValorActual[0].value
                      });
                      registroAux.setValue({
                        fieldId: 'custrecord_lmry_valor_actual',
                        value: numeroCorrelativo
                      });

                      registroAux.save();
                    }
                  }
                }

                //######################################################


                //QUITANDO VALORES DE RETENCION A LAS TRANSACCIONES APLICADAS
                var cantAplic = recordObj.getLineCount({
                  sublistId: 'apply'
                });
                for (var cuentaDocAplicado = 0; cuentaDocAplicado < cantAplic; cuentaDocAplicado++) {
                  var aplicar = recordObj.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: cuentaDocAplicado
                  });
                  if (aplicar == 'T' || aplicar == true) {
                    var vendorBillIdx = recordObj.getSublistValue({
                      sublistId: 'apply',
                      fieldId: 'internalid',
                      line: cuentaDocAplicado
                    });
                    // CARGAMOS LOS DATOS DE LA TRANSACCION
                    var recSOx = 0;
                    var searchVendor = search.lookupFields({
                      type: 'vendorbill',
                      id: vendorBillIdx,
                      columns: ['entity', 'account']
                    });
                    var tipotranrelated = '';
                    if (searchVendor.entity != null || searchVendor.account != null) {
                      recSOx = record.load({
                        type: 'vendorbill',
                        id: vendorBillIdx
                      });
                      encontroTransaccion = true;
                    } else {
                      var creditEntity = search.lookupFields({
                        type: 'vendorcredit',
                        id: vendorBillIdx,
                        columns: ['entity']
                      });
                      if (creditEntity.entity != null) {
                        recSOx = record.load({
                          type: 'vendorcredit',
                          id: vendorBillIdx
                        });
                        encontroTransaccion = true;
                      } else {
                        var expenseEntity = search.lookupFields({
                          type: 'expensereport',
                          id: vendorBillIdx,
                          columns: ['entity']
                        });
                        if (expenseEntity.entity != null) {
                          recSOx = record.load({
                            type: 'expensereport',
                            id: vendorBillIdx
                          });
                          tipotranrelated = 'expensereport';
                          encontroTransaccion = true;
                        } else {
                          encontroTransaccion = false;
                        }
                      }
                    }
                    if (tipotranrelated != 'expensereport') {
                      var cantItemx = recSOx.getLineCount({
                        sublistId: 'item'
                      });
                      for (var a = 0; a < cantItemx; a++) {
                        recSOx.setSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_4601_witaxapplies',
                          line: a,
                          value: false
                        });
                        recSOx.setSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_4601_witaxcode',
                          line: a,
                          value: ''
                        });
                        recSOx.setSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_4601_witaxrate',
                          line: a,
                          value: ''
                        });
                        recSOx.setSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_4601_witaxbaseamount',
                          line: a,
                          value: ''
                        });
                        recSOx.setSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_4601_witaxamount',
                          line: a,
                          value: ''
                        });
                      }
                    }

                    var cantExpnx = recSOx.getLineCount({
                      sublistId: 'expense'
                    });

                    for (var b = 0; b < cantExpnx; b++) {
                      recSOx.setSublistValue({
                        sublistId: 'expense',
                        fieldId: 'custcol_4601_witaxapplies',
                        line: b,
                        value: false
                      });
                      recSOx.setSublistValue({
                        sublistId: 'expense',
                        fieldId: 'custcol_4601_witaxcode',
                        line: b,
                        value: ''
                      });
                      recSOx.setSublistValue({
                        sublistId: 'expense',
                        fieldId: 'custcol_4601_witaxrate',
                        line: b,
                        value: ''
                      });
                      recSOx.setSublistValue({
                        sublistId: 'expense',
                        fieldId: 'custcol_4601_witaxbaseamount',
                        line: b,
                        value: ''
                      });
                      recSOx.setSublistValue({
                        sublistId: 'expense',
                        fieldId: 'custcol_4601_witaxamount',
                        line: b,
                        value: ''
                      });
                    }
                    recSOx.save();
                  }
                }
              }
            }
          }

          if (LMRY_Result[0] == 'MX' && library.getAuthorization(243, licenses) == true) {
            lbry_traslado_IVA.deleteTransactionIVA(context);
          }

        }//FIN DELETE


		// Diferente Delete y View
        if (type != 'delete' && type != 'view') {
			/**********************************************************************
			* Title : Uso de Installment para llenado de campos
			* User  : Richard Galvez Lopez
			* Date  : 05/03/2020
			/**********************************************************************/
			if (runtime.isFeatureInEffect('installments')) {
				if (library.getAuthorization(439, licenses) == true) {
					lbry_installment.updateInstallment(context.newRecord);
				}
			}
			/**********************************************************************/
        } // Diferente Delete y View

      } catch (err) {
        recordObj = context.newRecord;
        library.sendemail2(' [ beforeSubmit ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }
    }

    /**
     * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
     * @appliedtorecord recordType
     *
     * @param {String} type Operation types: create, edit, delete, xedit,
     *                      approve, cancel, reject (SO, ER, Time Bill, PO & RMA only)
     *                      pack, ship (IF only)
     *                      dropship, specialorder, orderitems (PO only)
     *                      paybills (vendor payments)
     * @returns {Void}
     */
    function afterSubmit(context) {
      try {
        type = context.type;
        recordObj = context.newRecord;
        var form = context.form;

        ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

        var subsidiary = recordObj.getValue({
          fieldId: 'subsidiary'
        });

        licenses = library.getLicenses(subsidiary);

        var LMRY_Result = ValidateAccess(subsidiary, form, licenses);

        if (type == 'create' || type == 'edit') {
          if (type == 'create') {
            if (recordObj.id == '' || recordObj.id == null || recordObj.id == 0) {
              return true;
            }
            recordObj = record.load({
              type: recordObj.type,
              id: recordObj.id,
              isDynamic: false
            });

          }

          if (LMRY_Result[0] == 'MX') {
            if (library.getAuthorization(151, licenses) == true) {
              if(ST_FEATURE === true || ST_FEATURE === "T") {
                ST_Library_DIOT.CalculoDIOT(recordObj);
              }else {
                libraryDIOT.CalculoDIOT(recordObj);
              }
            }

            if (library.getAuthorization(243, licenses) == true) {
              lbry_traslado_IVA.afterSubmitTrasladoIva(context);
            }

          }

          var internalID = recordObj.id;

          // Para Colombia, Bolivia y Paraguay - Enabled Feature WHT Latam
          /*if (LMRY_Result[0] == 'CO' || LMRY_Result[0] == 'BO' || LMRY_Result[0] == 'PY') {
            if (library.getAuthorization(27) == true || library.getAuthorization(46) == true || library.getAuthorization(47) == true) {
              library1.Create_WHT_Payment_Latam('vendorpayment', recordObj.id);
            }
          }*/

          // Solo para Peru - Retenciones en compras
          if ((type == 'create') && LMRY_Result[0] == 'PE') {
            // PE - Registro de Compras Electrónico
            if (library.getAuthorization(1, licenses) == true) {
              var variable = record.load({
                type: 'vendorpayment',
                id: recordObj.id
              });


              var currency_billpayment = variable.getValue({
                fieldId: 'currency'
              });

              var featuresubs = runtime.isFeatureInEffect({
                feature: 'SUBSIDIARIES'
              });

              if (featuresubs) {
                var currency_sub = variable.getValue({
                  fieldId: 'subsidiary'
                });
                currency_sub = search.lookupFields({
                  type: 'subsidiary',
                  id: currency_sub,
                  columns: ['currency']
                });
                currency_sub = currency_sub.currency[0].value;
              } else {
                var currency_sub = runtime.getCurrentScript().getParameter({
                  name: 'custscript_lmry_currency'
                });
              }


              var currency_record = '';

              var recSOx;
              var cantLineas = variable.getLineCount({
                sublistId: 'apply'
              });
              //para los pagos
              var montoTot = 0;
              var montoTot2 = 0;
              for (var cuenta = 0; cuenta < cantLineas; cuenta++) {
                //nlapiGetLineItemValue('apply', 'amount', cuenta);
                var aplicar = variable.getSublistValue({
                  sublistId: 'apply',
                  fieldId: 'apply',
                  line: cuenta
                });
                if (aplicar == 'T' || aplicar == true) {
                  var vendorBillIdx = variable.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'internalid',
                    line: cuenta
                  });
                  var vendorBillTe = search.lookupFields({
                    type: 'vendorbill',
                    id: vendorBillIdx,
                    columns: ['entity', 'account']
                  });
                  if (vendorBillTe.entity != null || vendorBillTe.account != null) {
                    recSOx = record.load({
                      type: 'vendorbill',
                      id: vendorBillIdx
                    });
                    encontroTransaccion = true;
                  } else {
                    var creditEntity = search.lookupFields({
                      type: 'vendorcredit',
                      id: vendorBillIdx,
                      columns: ['entity']
                    });
                    if (creditEntity.entity != null) {
                      recSOx = record.load({
                        type: 'vendorcredit',
                        id: vendorBillIdx
                      });
                      encontroTransaccion = true;
                    } else {
                      var expenseEntity = search.lookupFields({
                        type: 'expensereport',
                        id: vendorBillIdx,
                        columns: ['entity']
                      });
                      if (expenseEntity.entity != null) {
                        recSOx = record.load({
                          type: 'expensereport',
                          id: vendorBillIdx
                        });
                        encontroTransaccion = true;
                      } else {
                        encontroTransaccion = false;
                      }
                    }
                  }

                  /*var tipoCambiofac = recSOx.getValue({
                    fieldId: 'exchangerate'
                  });

                  var montofac = parseFloat(recSOx.getValue({
                    fieldId: 'usertotal'
                  })) * parseFloat(tipoCambiofac);*/

                  var montofac = parseFloat(recSOx.getValue({
                    fieldId: 'usertotal'
                  }));

                  if (parseFloat(recSOx.getValue({
                      fieldId: 'taxtotal'
                    })) > 0) {

                    montoTot = montoTot + montofac;

                  }
                  var tipoDocumento = recSOx.getValue({
                    fieldId: 'custbody_lmry_document_type'
                  });
                  //General Preferences  LATAM - PE DOCUMENTO FISCAL
                  var documentType = scriptObj.getParameter({
                    name: 'custscript_lmry_pe_doc_fiscal'
                  });
                  //Tabla LatamReady - Pe Retenciones

                  // LatamReady - PE Retenciones
                  var RetencionesTL = search.create({
                    type: 'customrecord_lmry_pe_retenciones',
                    columns: ['internalid', 'custrecord_lmry_pe_retention_base', 'custrecord_lmry_pe_moneda_ret']
                  });
                  if (tipoDocumento != null && tipoDocumento != '') {
                    RetencionesTL.filters.push(search.createFilter({
                      name: 'custrecord_lmry_pe_tipo_doc_fiscal',
                      operator: search.Operator.ANYOF,
                      values: [tipoDocumento]
                    }));
                  }


                  var RetencionesTLResult = RetencionesTL.run().getRange(0, 1);
                  if (RetencionesTLResult != null && RetencionesTLResult != '') {
                    montoBaseRetencion = RetencionesTLResult[0].getValue('custrecord_lmry_pe_retention_base');
                    currency_record = RetencionesTLResult[0].getValue('custrecord_lmry_pe_moneda_ret');
                    if (RetencionesTLResult.length > 0) {
                      montoTot2 = montoTot2 + montofac;
                    }
                  }
                }
              }
              var serieCompr = variable.getValue({
                fieldId: 'custbody_lmry_serie_retencion'
              });

              buscaImpuestos();


              if (serieCompr != null && serieCompr != '') {
                buscaCorrelativo(serieCompr);
                var exchangeRT = variable.getValue({
                  fieldId: 'exchangerate'
                });

                var proveedor = variable.getValue({
                  fieldId: 'entity'
                });
                var datosproveedor = search.lookupFields({
                  type: 'vendor',
                  id: proveedor,
                  columns: ['custentity_lmry_es_agente_retencion', 'custentity_lmry_es_buen_contribuyente', 'custentity_lmry_es_agente_percepcion', 'custentity_lmry_subsidiary_country']
                });
                if (datosproveedor == null) {
                  //VALIDA QUE NO SEA PROVEEDOR
                  return true;
                }
                var esAgenteRetencion = datosproveedor.custentity_lmry_es_agente_retencion[0].value;
                var esBuenContribuyente = datosproveedor.custentity_lmry_es_buen_contribuyente[0].value;
                var esAgentePercepcion = datosproveedor.custentity_lmry_es_agente_percepcion[0].value;
                var countryVendor = datosproveedor.custentity_lmry_subsidiary_country[0].text;
                countryVendor = countryVendor.substring(0, 2);
                countryVendor = countryVendor.toUpperCase();

                var tipoCambio = variable.getValue({
                  fieldId: 'exchangerate'
                });
                /*var montoTotal = parseFloat(variable.getValue({
                  fieldId: 'total'
                })) * parseFloat(tipoCambio);*/
                var montoTotal = parseFloat(variable.getValue({
                  fieldId: 'total'
                }));

                //montoTot en moneda transaccion y montoTot2 (transaccion)
                //montoBaseRetencion esta en moneda del record (soles)

                if (currency_billpayment != currency_record) {
                  if (currency_sub == currency_record) {
                    montoBaseRetencion = parseFloat(montoBaseRetencion) / parseFloat(tipoCambio);
                    exchangeCertificado = tipoCambio;

                  } else {
                    var featuremulti = runtime.isFeatureInEffect({
                      feature: 'MULTIBOOK'
                    });
                    if (featuremulti) {
                      var c_books = variable.getLineCount({
                        sublistId: 'accountingbookdetail'
                      });
                      if (c_books > 0) {
                        for (var books = 0; books < c_books; books++) {
                          if (currency_record == variable.getSublistValue({
                              sublistId: 'accountingbookdetail',
                              fieldId: 'currency',
                              line: books
                          })) {
                            montoBaseRetencion = parseFloat(montoBaseRetencion) / parseFloat(variable.getSublistValue({
                              sublistId: 'accountingbookdetail',
                              fieldId: 'exchangerate',
                              line: books
                            }));
                            exchangeCertificado = variable.getSublistValue({
                              sublistId: 'accountingbookdetail',
                              fieldId: 'exchangerate',
                              line: books
                            });
                          }
                        }
                      }
                    }
                  }
                }

                log.error('montoTot - montoTot2 - montoBaseRetencion 1', montoTot + "-" + montoTot2 + "-" + montoBaseRetencion);

                if ((montoTot > montoBaseRetencion && montoTot2 > montoBaseRetencion) &&
                  esAgenteRetencion != 1 && esAgentePercepcion != 1 && esBuenContribuyente != 1 &&
                  (countryVendor == 'PE' || countryVendor == '' || countryVendor == null)) {

                  var nuevoRegistro = record.create({
                    type: 'customrecord_lmry_comprobante_retencion',
                    isDynamic: true
                  });
                  nuevoRegistro.setValue({
                    fieldId: 'custrecord_lmry_serie_retencion',
                    value: serieCompr
                  });
                  nuevoRegistro.setValue({
                    fieldId: 'custrecord_lmry_pago_relacionado',
                    value: internalID
                  });
                  nuevoRegistro.setValue({
                    fieldId: 'custrecord_lmry_tipo_cambio_pago',
                    value: parseFloat(exchangeCertificado)
                  });

                  nuevoRegistro.setValue({
                    fieldId: 'custrecord_lmry_proveedor',
                    value: proveedor
                  });

                  var campo_accounting = "0|";

                  var array_book = new Array();
                  var array_exchange = new Array();

                  var lineas_book = variable.getLineCount({
                    sublistId: 'accountingbookdetail'
                  });

                  if (lineas_book > 0) {
                    for (var l = 0; l < lineas_book; l++) {
                      var book_id = variable.getSublistValue({
                        sublistId: 'accountingbookdetail',
                        fieldId: 'accountingbook',
                        line: l
                      });
                      var exchange_value = variable.getSublistValue({
                        sublistId: 'accountingbookdetail',
                        fieldId: 'exchangerate',
                        line: l
                      });
                      array_book.push(book_id);
                      array_exchange.push(exchange_value);
                    }


                    for (var m = 0; m < array_book.length; m++) {
                      if (m == array_book.length - 1) {
                        campo_accounting += array_book[m];
                      } else {
                        campo_accounting += array_book[m] + "|";
                      }
                    }

                    if (array_book.length > 0) {
                      campo_accounting += "&" + exchangeRT + "|";
                    } else {
                      campo_accounting += "&" + exchangeRT;
                    }

                    for (var m = 0; m < array_book.length; m++) {
                      if (m == 0 && array_book.length > 1) {
                        campo_accounting += array_exchange[m] + "|";
                      }
                      if (m == 0 && array_book.length == 1) {
                        campo_accounting += array_exchange[m];
                      }
                      if (m == array_book.length - 1 && m != 0) {
                        campo_accounting += array_exchange[m];
                      }
                      if (m != array_book.length - 1 && m != 0) {
                        campo_accounting += array_exchange[m] + "|";
                      }
                    }
                  } else {
                    campo_accounting = '0';
                    campo_accounting += "&" + exchangeRT;
                  }

                  nuevoRegistro.setValue({
                    fieldId: 'custrecord_lmry_accounting_book',
                    value: campo_accounting
                  });

                  for (var cuenta = 0; cuenta < cantLineas; cuenta++) {

                    //nlapiGetLineItemValue('apply', 'amount', cuenta);
                    var aplicar = variable.getSublistValue({
                      sublistId: 'apply',
                      fieldId: 'apply',
                      line: cuenta
                    });
                    if (aplicar == 'T' || aplicar == true) {
                      var vendorBillIdx = variable.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'internalid',
                        line: cuenta
                      });

                      nuevoRegistro.setValue({
                        fieldId: 'custrecord_lmry_transaccion_pagada',
                        value: vendorBillIdx
                      });

                      var vendorBillTe = search.lookupFields({
                        type: 'vendorbill',
                        id: vendorBillIdx,
                        columns: ['entity', 'account']
                      });

                      if (vendorBillTe.entity != null || vendorBillTe.account != null) {
                        recSOx = record.load({
                          type: 'vendorbill',
                          id: vendorBillIdx
                        });
                        encontroTransaccion = true;
                      } else {
                        var creditEntity = search.lookupFields({
                          type: 'vendorcredit',
                          id: vendorBillIdx,
                          columns: ['entity']
                        });
                        if (creditEntity.entity != null) {
                          recSOx = record.load({
                            type: 'vendorcredit',
                            id: vendorBillIdx
                          });
                          encontroTransaccion = true;
                        } else {
                          var expenseEntity = search.lookupFields({
                            type: 'expensereport',
                            id: vendorBillIdx,
                            columns: ['entity']
                          });
                          if (expenseEntity.entity != null) {
                            recSOx = record.load({
                              type: 'expensereport',
                              id: vendorBillIdx
                            });
                            encontroTransaccion = true;
                          } else {
                            encontroTransaccion = false;
                          }
                        }
                      }

                      //VALIDA SI ES LETRA O OTROS DOCUMENTOS AFECTOS A RETENCION
                      var tipoDocumento = recSOx.getValue({
                        fieldId: 'custbody_lmry_document_type'
                      });

                      // Tabla LatamReady - Pe Retenciones
                      var RetencionesTL = search.create({
                        type: 'customrecord_lmry_pe_retenciones',
                        columns: ['internalid', 'custrecord_lmry_pe_moneda_ret']
                      });
                      if (tipoDocumento != null && tipoDocumento != '') {
                        RetencionesTL.filters.push(search.createFilter({
                          name: 'custrecord_lmry_pe_tipo_doc_fiscal',
                          operator: search.Operator.ANYOF,
                          values: [tipoDocumento]
                        }));
                      }
                      var RetencionesTLResult = RetencionesTL.run().getRange(0, 1000); // verifica si es Factura
                      var exitoRe = false;
                      if (RetencionesTLResult != null && RetencionesTLResult != '') {
                        if (RetencionesTLResult.length > 0) {
                          exitoRe = true;
                        }
                      }

                      // Tipo de Moneda
                      var tipoMoneda = recSOx.getValue({
                        fieldId: 'currency'
                      });
                      // Tipo de Cambio
                      var tipoCambiofact = recSOx.getValue({
                        fieldId: 'exchangerate'
                      });
                      // Monto Total
                      /*var montofactura = parseFloat(recSOx.getValue({
                        fieldId: 'usertotal'
                      })) * parseFloat(tipoCambiofact);*/
                      var montofactura = parseFloat(recSOx.getValue({
                        fieldId: 'usertotal'
                      }));
                      var valorRetenido = 0;

                      log.error('montofactura - montoBaseRetencion - montoTotal 2', montofactura + "-" + montoBaseRetencion + "-" + montoTotal);

                      //valida si el tipo de documento esta dentro de la tabla "LatamReady - Pe Retenciones :)"
                      if (exitoRe) {
                        // montofactura = usertotal (Transaccion)
                        if (montofactura > montoBaseRetencion || (montoTotal > montoBaseRetencion && montofactura < montoBaseRetencion)) {
                          //variable de la factura
                          //Tipo de documento no sea Comprobante de No domiciliado
                          var conProNoDoc = recSOx.getText({
                            fieldId: 'custbody_lmry_document_type'
                          });

                          if (conProNoDoc != 'Comprobante de No Domiciliado') {
                            // Tipo de Documento es Letra
                            if (parseFloat(recSOx.getValue({
                                fieldId: 'taxtotal'
                              })) > 0) {
                              if (tipoDocumento == documentType) {
                                /*if(tipotran!='expensereport'){
                                  var cantItemx = recSOx.getLineCount({
                                    sublistId: 'item'
                                  });
                                  for (var a = 0; a < cantItemx; a++) {

                                    var montoPagoTxAplicada = recSOx.getSublistValue({
                                      sublistId: 'item',
                                      fieldId: 'grossamt',
                                      line: a
                                    });
                                    var tipoDocTransaccPagada = recSOx.getSublistValue({
                                      sublistId: 'item',
                                      fieldId: 'custcol_lmry_exp_rep_type_doc',
                                      line: a
                                    });
                                    var serieTransaccionPagada = recSOx.getSublistValue({
                                      sublistId: 'item',
                                      fieldId: 'custcol_lmry_exp_rep_serie_doc',
                                      line: a
                                    });
                                    var numeroTransaccioPagada = recSOx.getSublistValue({
                                      sublistId: 'item',
                                      fieldId: 'custcol_lmry_exp_rep_num_doc',
                                      line: a
                                    });
                                    var montoTransaccionPagada = recSOx.getSublistValue({
                                      sublistId: 'item',
                                      fieldId: 'custcol_lmry_doc_monto_origen',
                                      line: a
                                    });
                                    var fechaDetalleLetraA = recSOx.getSublistValue({
                                      sublistId: 'item',
                                      fieldId: 'custcol_lmry_doc_fecha_origen',
                                      line: a
                                    });

                                    validaFecha(fechaDetalleLetraA);
                                    var monedaTransaccioPagada = recSOx.getValue({
                                      fieldId: 'currency'
                                    });
                                    //var montoFormula = parseFloat(montoTransaccionPagada)/((100-parseFloat(valorporc))/100)*(montoPagoTxAplicada/recSOx.getFieldValue('usertotal'));

                                    var montoFormula = variable.getSublistValue({
                                      sublistId: 'apply',
                                      fieldId: 'amount',
                                      line: cuenta
                                    });
                                    //Monto Pago / (100%+tasa WHT) * importe de linea / importe total de documento (letra)
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_comp_retencion',
                                      value: correlativo
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_fecha_transaccion_pagada',
                                      value: fechaDetalleLetraA
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_doc_transaccion_pagada',
                                      value: tipoDocTransaccPagada
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_serie_transaccion_pagada',
                                      value: serieTransaccionPagada
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_numero_transaccion_pagad',
                                      value: numeroTransaccioPagada
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_moneda_transaccion_pagad',
                                      value: monedaTransaccioPagada
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_monto_transaccion_pagada',
                                      value: parseFloat(montoTransaccionPagada) * parseFloat(exchangeRT)
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_monto_pagado_transaccion',
                                      value: parseFloat(montoPagoTxAplicada) * parseFloat(exchangeRT)
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_tasa',
                                      value: valorporc
                                    });
                                    nuevoRegistro.setValue({
                                      fieldId: 'custrecord_lmry_monto_formula',
                                      value: parseFloat(montoPagoTxAplicada) * parseFloat(exchangeRT)
                                    });
                                    nuevoRegistro.save();

                                  }
                                }
                                var cantExpnx = recSOx.getLineCount({
                                  sublistId: 'expense'
                                });
                                for (var b = 0; b < cantExpnx; b++) {
                                  var montoPagoTxAplicada = recSOx.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'grossamt',
                                    line: b
                                  });
                                  var tipoDocTransaccPagada = recSOx.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_lmry_exp_rep_type_doc',
                                    line: b
                                  });
                                  var serieTransaccionPagada = recSOx.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_lmry_exp_rep_serie_doc',
                                    line: b
                                  });
                                  var numeroTransaccioPagada = recSOx.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_lmry_exp_rep_num_doc',
                                    line: b
                                  });
                                  var montoTransaccionPagada = recSOx.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_lmry_doc_monto_origen',
                                    line: b
                                  });
                                  var fechaDetalleLetraB = recSOx.getSublistValue({
                                    sublistId: 'expense',
                                    fieldId: 'custcol_lmry_doc_fecha_origen',
                                    line: b
                                  });

                                  validaFecha(fechaDetalleLetraB);
                                  var monedaTransaccioPagada = recSOx.getValue({
                                    fieldId: 'currency'
                                  });
                                  //var montoFormula = parseFloat(montoTransaccionPagada)/((100-parseFloat(valorporc))/100)*(montoPagoTxAplicada/recSOx.getFieldValue('usertotal'));
                                  var montoFormula = variable.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'amount',
                                    line: cuenta
                                  });
                                  //Monto Pago / (100%+tasa WHT) * importe de linea / importe total de documento (letra)
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_comp_retencion',
                                    value: correlativo
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_fecha_transaccion_pagada',
                                    value: fechaDetalleLetraB
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_doc_transaccion_pagada',
                                    value: tipoDocTransaccPagada
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_serie_transaccion_pagada',
                                    value: serieTransaccionPagada
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_numero_transaccion_pagad',
                                    value: numeroTransaccioPagada
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_moneda_transaccion_pagad',
                                    value: monedaTransaccioPagada
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_monto_transaccion_pagada',
                                    value: parseFloat(montoTransaccionPagada) * parseFloat(exchangeRT)
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_monto_pagado_transaccion',
                                    value: parseFloat(montoPagoTxAplicada) * parseFloat(exchangeRT)
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_tasa',
                                    value: valorporc
                                  });
                                  nuevoRegistro.setValue({
                                    fieldId: 'custrecord_lmry_monto_formula',
                                    value: parseFloat(montoPagoTxAplicada) * parseFloat(exchangeRT)
                                  });
                                  nuevoRegistro.save();
                                }*/
                              } else {
                                // Fecha de la transaccion
                                var valorFecha = recSOx.getValue({
                                  fieldId: 'trandate'
                                });

                                // Valida la fecha
                                validaFecha(valorFecha);

                                var montoPagoTxAplicada = variable.getSublistValue({
                                  sublistId: 'apply',
                                  fieldId: 'amount',
                                  line: cuenta
                                });
                                var montoPagoTxAplicadaDue = variable.getSublistValue({
                                  sublistId: 'apply',
                                  fieldId: 'due',
                                  line: cuenta
                                });
                                var montoPagoTxAplicadaDisc = variable.getSublistValue({
                                  sublistId: 'apply',
                                  fieldId: 'disc',
                                  line: cuenta
                                });
                                var serieTransaccionPagada = recSOx.getValue({
                                  fieldId: 'custbody_lmry_serie_doc_cxp'
                                });
                                var numeroTransaccioPagada = recSOx.getValue({
                                  fieldId: 'custbody_lmry_num_preimpreso'
                                });
                                var monedaTransaccioPagada = recSOx.getValue({
                                  fieldId: 'currency'
                                });
                                var montoTransaccionPagada = recSOx.getValue({
                                  fieldId: 'usertotal'
                                });

                                var montoFormula = parseFloat(montoPagoTxAplicada) * parseFloat(exchangeCertificado) / ((100 - parseFloat(valorporc)) / 100); // / (100%+tasa WHT)
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_comp_retencion',
                                  value: correlativo
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_fecha_transaccion_pagada',
                                  value: valorFecha
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_doc_transaccion_pagada',
                                  value: tipoDocumento
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_serie_transaccion_pagada',
                                  value: serieTransaccionPagada
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_numero_transaccion_pagad',
                                  value: numeroTransaccioPagada
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_moneda_transaccion_pagad',
                                  value: monedaTransaccioPagada
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_monto_transaccion_pagada',
                                  value: parseFloat(montoTransaccionPagada) * parseFloat(exchangeCertificado)
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_monto_pagado_transaccion',
                                  value: parseFloat(montoPagoTxAplicada) * parseFloat(exchangeCertificado)
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_tasa',
                                  value: valorporc
                                });
                                nuevoRegistro.setValue({
                                  fieldId: 'custrecord_lmry_monto_formula',
                                  value: montoFormula
                                });
                                var IDAux = nuevoRegistro.save();
                              }
                            }
                          }
                        }
                      }

                    }
                  }
                  if (parseFloat(auxiliarTieneDosTasas) == 1 || parseFloat(auxiliarTieneDosTasas) == 10) {
                    var valor = parseFloat(numeroActual) + 1;
                    var otherId = record.submitFields({
                      type: 'customrecord_lmry_serie_compro_retencion',
                      id: serieCompr,
                      values: {
                        'custrecord_lmry_valor_actual': valor
                      }
                    });
                  }
                  if (parseFloat(auxiliarTieneDosTasas) == 11) {
                    var valor = parseFloat(numeroActual) + 2;
                    var otherId = record.submitFields({
                      type: 'customrecord_lmry_serie_compro_retencion',
                      id: serieCompr,
                      values: {
                        'custrecord_lmry_valor_actual': valor
                      }
                    });
                  }
                }
              }
            }
          }
        }

        //RETENCIONES BRAZIL, VOID PAYMENT - VOID JOURNAL
        if ((type == 'edit' || type == 'delete') && LMRY_Result[0] == 'BR' && library.getAuthorization(464, licenses) == true) {

          var memoWHT = '';
          if(type == 'edit'){
            var recordWHT = record.load({type: recordObj.type,id: recordObj.id,isDynamic: false});
            memoWHT = recordWHT.getValue('voided');
          }

          if((memoWHT == true || memoWHT == 'T') || type == 'delete') {

            var searchBRLog = search.create({type: 'customrecord_lmry_br_wht_purchase_log', columns: ['custrecord_lmry_br_wht_log_ids','custrecord_lmry_br_wht_log_journal','custrecord_lmry_br_wht_log_id_br'],
            filters: [{name:'custrecord_lmry_br_wht_log_id_payment', operator: 'is', values: recordObj.id}]})

            var resultBRLog = searchBRLog.run().getRange({start:0,end:1});

            if(resultBRLog != null && resultBRLog.length == 1){
              var journal = resultBRLog[0].getValue('custrecord_lmry_br_wht_log_journal');
              var billsMultaInteres = resultBRLog[0].getValue('custrecord_lmry_br_wht_log_ids');
              var brTransaction = resultBRLog[0].getValue('custrecord_lmry_br_wht_log_id_br');

              if(journal){
                if(type == 'delete'){
                  record.delete({type: 'journalentry',id: journal});
                }else{
                  transaction.void({type: 'journalentry',id: journal});
                }
              }

              if(billsMultaInteres){
                billsMultaInteres = billsMultaInteres.split('|');
                for(var i = 0; i < billsMultaInteres.length - 1; i++){
                  if(type == 'delete'){
                    record.delete({type: 'vendorbill',id: billsMultaInteres[i]});
                  }else{
                    transaction.void({type: 'vendorbill',id: billsMultaInteres[i]});
                  }
                }
              }

              if(brTransaction){
                var brTransaction = brTransaction.split('|');
                for(var i = 0; i < brTransaction.length - 1; i++){
                  var brTransactionAux = brTransaction[i].split(';');

                  var recordBR = search.lookupFields({type: 'customrecord_lmry_br_transaction_fields', id: brTransactionAux[2], columns: ['custrecord_lmry_br_multa','custrecord_lmry_br_interes']});

                  var newMulta = '', newInteres = '';

                  (parseFloat(recordBR.custrecord_lmry_br_multa) > 0) ? newMulta = recordBR.custrecord_lmry_br_multa : newMulta = 0;
                  (parseFloat(recordBR.custrecord_lmry_br_interes) > 0) ? newInteres = recordBR.custrecord_lmry_br_interes : newInteres = 0;

                  if(parseFloat(brTransactionAux[0]) > 0){
                    newMulta = parseFloat(recordBR.custrecord_lmry_br_multa) - parseFloat(brTransactionAux[0]);
                  }

                  if(parseFloat(brTransactionAux[1]) > 0){
                    newInteres = parseFloat(recordBR.custrecord_lmry_br_interes) - parseFloat(brTransactionAux[1]);
                  }

                  record.submitFields({type: 'customrecord_lmry_br_transaction_fields', id: brTransactionAux[2], values: {custrecord_lmry_br_multa: newMulta, custrecord_lmry_br_interes: newInteres}});

                }
              }

            }//FIN SI EL PAGO ESTA EN EL BR WHT PURCHASE LOG


          }//FIN SI ES VOIDED

        }// FIN SI ES BRAZIL WHT PURCHASE


      } catch (err) {
        recordObj = context.newRecord;
        library.sendemail2(' [ afterSubmit ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }
      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Funciones solo para Peru - Retenciones:
     *  LatamReady - Serie Comprob Retencion
     * 		- buscaCorrelativo
     * 		- asignaCorrelativo
     * 		- buscaImpuestos
     * 		- validaFecha
     * --------------------------------------------------------------------------------------------------- */
    function buscaCorrelativo(idSerie) {
      var seriecompret = search.lookupFields({
        type: 'customrecord_lmry_serie_compro_retencion',
        id: idSerie,
        columns: ['custrecord_lmry_valor_actual', 'custrecord_lmry_cant_digitos', 'internalid']
      });
      numeroActual = parseFloat(seriecompret.custrecord_lmry_valor_actual);
      cantDigitos = seriecompret.custrecord_lmry_cant_digitos;
      idValorActual = seriecompret.internalid;
    }

    function asignaCorrelativo(valorCorrelativo) {
      var stringCorrelativo = valorCorrelativo + '';
      var cadena = '0000000000';
      cadena = cadena + stringCorrelativo + '';
      cadena = cadena.substring(cadena.length - parseFloat(cantDigitos), cadena.length);
      return stringCorrelativo;
    }

    /**************************************************
     * Custom Record .: Withholding Tax Code
     * interval ID ...: customrecord_4601_witaxcode
     * Bundle ID .....: 47459 - Name : Withholding Tax
     **************************************************/
    function buscaImpuestos() {
      var filtrosImpuestos = new Array();
      filtrosImpuestos[0] = search.createFilter({
        name: 'isinactive',
        operator: search.Operator.IS,
        values: ['F']
      });
      filtrosImpuestos[1] = search.createFilter({
        name: 'custrecord_4601_wtc_description',
        operator: search.Operator.CONTAINS,
        values: ['Retencion del IGV']
      });
      var transacdataImpuestossearch = search.create({
        type: 'customrecord_4601_witaxcode',
        columns: ['custrecord_4601_wtc_effectivefrom', 'custrecord_4601_wtc_rate', 'internalid'],
        filters: filtrosImpuestos
      });
      var transacdataImpuestos = transacdataImpuestossearch.run().getRange(0, 1000);
      for (var cuentaImpuesto = 0; cuentaImpuesto < transacdataImpuestos.length; cuentaImpuesto++) {
        var columns = transacdataImpuestos[cuentaImpuesto].columns;
        fechaObtenida = transacdataImpuestos[cuentaImpuesto].getValue(columns[0]);
        //if (fechaObtenida != '' && fechaObtenida != null) {
        valorporcB = transacdataImpuestos[cuentaImpuesto].getValue(columns[1]);
        WTHoldingB = transacdataImpuestos[cuentaImpuesto].getValue(columns[2]);
        //} else {
        valorporcA = transacdataImpuestos[cuentaImpuesto].getValue(columns[1]);
        WTHoldingA = transacdataImpuestos[cuentaImpuesto].getValue(columns[2]);
        //}
      }
    }

    function validaFecha(valorFecha) {

      var ValorFechaDateprev = format.parse({
        value: valorFecha,
        type: format.Type.DATE
      });
      var ValorFechaDate = format.format({
        value: ValorFechaDateprev,
        type: format.Type.DATE
      });
      if (fechaObtenida != null && fechaObtenida != '') {
        var FechaObtenidaDateprev = format.parse({
          value: fechaObtenida,
          type: format.Type.DATE
        });
        var FechaObtenidaDate = format.format({
          value: FechaObtenidaDateprev,
          type: format.Type.DATE
        });
      }

      if (fechaObtenida != null & fechaObtenida != '') {
        if (ValorFechaDate < FechaObtenidaDate) {
          valorporc = valorporcA + '';
          valorporc = valorporc.split('%')[0];
          WTHolding = WTHoldingA;
          auxiliarTieneDosTasas = '1' + auxiliarTieneDosTasas.substring(1, 2);
          if (correlativoA == null) {
            if (correlativo1 == null) {
              correlativo1 = parseFloat(numeroActual) + 1;
              correlativoA = asignaCorrelativo(correlativo1);
            } else {
              correlativo2 = parseFloat(numeroActual) + 2;
              correlativoA = asignaCorrelativo(correlativo2);
            }
          }
          correlativo = correlativoA;
        } else {
          valorporc = valorporcB;
          valorporc = valorporc.split('%')[0];
          WTHolding = WTHoldingB;
          auxiliarTieneDosTasas = auxiliarTieneDosTasas.substring(0, 1) + '1';
          if (correlativoB == null) {
            if (correlativo1 == null) {
              correlativo1 = parseFloat(numeroActual) + 1;
              correlativoB = asignaCorrelativo(correlativo1);
            } else {
              correlativo2 = parseFloat(numeroActual) + 2;
              correlativoB = asignaCorrelativo(correlativo2);
            }
          }
          correlativo = correlativoB;
        }
      } else {
        valorporc = valorporcA + '';
        valorporc = valorporc.split('%')[0];
        WTHolding = WTHoldingA;
        auxiliarTieneDosTasas = '1' + auxiliarTieneDosTasas.substring(1, 2);
        if (correlativoA == null) {
          if (correlativo1 == null) {
            correlativo1 = parseFloat(numeroActual) + 1;
            correlativoA = asignaCorrelativo(correlativo1);
          } else {
            correlativo2 = parseFloat(numeroActual) + 2;
            correlativoA = asignaCorrelativo(correlativo2);
          }
        }
        correlativo = correlativoA;
      }

    }

    /* ------------------------------------------------------------------------------------------------------
     * A la variable featureId se le asigna el valore que le corresponde
     * --------------------------------------------------------------------------------------------------- */
    function ValidateAccess(ID, form, licenses) {
      var LMRY_access = false;
      var LMRY_countr = new Array();
      var LMRY_Result = new Array();
      try {
        // Oculta todos los campos de cabecera Latam
        if (type == 'view') {
          library.onFieldsHide([2], form, isURET);
        }

        // Inicializa variables Locales y Globales
        LMRY_countr = library.Validate_Country(ID);
        // Verifica que el arreglo este lleno
        if (LMRY_countr.length < 1) {
          return true;
        }
        if ((type == 'view' || type == 'edit') && (form != '' && form != null)) {
          Library_HideView.HideSubTab(form, LMRY_countr[1], recordObj.type,licenses);
        }
        LMRY_access = library.getCountryOfAccess(LMRY_countr, licenses);

        // Solo si tiene acceso
        if (LMRY_access == true) {
          // Solo en ver
          if (type == 'view') {
            library.onFieldsDisplayBody(form, LMRY_countr[1], 'custrecord_lmry_on_bill_payment', isURET);
          }

          // valida si es agente de rentencion
          var EsAgente = IsAgenteReten(ID);
          if (EsAgente == 'F' || EsAgente == 'f' || EsAgente == false) {

            // Oculta el campo
            var Field = recordObj.getField({
              fieldId: 'custbody_lmry_serie_retencion'
            });
            if (Field != null && Field != '') {
              Field.isDisplay = false;
            }
          }
        }

        // Asigna Valores
        LMRY_Result[0] = LMRY_countr[0];
        LMRY_Result[1] = LMRY_countr[1];
        LMRY_Result[2] = LMRY_access;
      } catch (err) {
        library.sendemail2(' [ ValidateAccess ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }

      return LMRY_Result;
    }

    function IsAgenteReten(IdSubsidiary) {
      var IsAgente = 'F';
      //if ( request.getMethod() == 'GET' ) {

      var featuresubs = runtime.isFeatureInEffect({
        feature: 'SUBSIDIARIES'
      });
      if (featuresubs == true) {
        if (IdSubsidiary != '' && IdSubsidiary != null) {
          IsAgente = search.lookupFields({
            type: 'subsidiary',
            id: IdSubsidiary,
            columns: ['custrecord_lmry_agente_de_retencion']
          });
          IsAgente = IsAgente.custrecord_lmry_agente_de_retencion;
        }
      } else {
        IsAgente = scriptObj.getParameter({
          name: 'custscript_lmry_agente_de_retencion'
        });
      }

      return IsAgente;
    }

    function onClick(type, form) {
      if ((runtime.executionContext === runtime.ContextType.USER_INTERFACE) && (type == 'view')) {

        form.addButton({
          id: 'custpage_Add',
          label: 'Imprimir Comp. Retencion',
          functionName: 'onclick_event_pagoProv()'
        });
      }
    }

    return {
      beforeLoad: beforeLoad,
      beforeSubmit: beforeSubmit,
      afterSubmit: afterSubmit
    }
  });
