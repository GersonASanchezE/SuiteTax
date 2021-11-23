/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_VendorCreditCLNT_V2.0.js				            ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 20 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 * @NModuleScope Public
 */


define(['N/log', 'N/record', 'N/runtime', 'N/search', 'N/http', 'N/currentRecord', 'N/url', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0',
    './Latam_Library/LMRY_libNumberInWordsLBRY_V2.0', './Latam_Library/LMRY_Val_TransactionLBRY_V2.0', './Latam_Library/LMRY_ExchangeRate_LBRY_V2.0', './Latam_Library/LMRY_AlertTraductorPurchase_LBRY_V2.0',
    './Latam_Library/LMRY_WebService_LBRY_v2.0.js', './Latam_Library/LMRY_ST_Transaction_ConfigFields_LBRY_V2.0'
  ],

  function(log, record, runtime, search, http, currentRecord, url, library, library1, library2, library_ExchRate, libAlert, LR_webService, ST_ConfigFields) {

    var scriptObj = runtime.getCurrentScript();
    var LMRY_script = 'LatamReady - Vendor Credit CLNT V2.0';
    var LMRY_access = false;
    var LMRY_countr = new Array();
    var tipoDoc = '';
    var Val_Campos = new Array();
    var Val_Campos_Linea = new Array();
    var recordObj = null;
    var flag = false;
    var Language = '';
    var type = '';
    var licenses = [];
    var LMRY_swsubs = false;
    var LMRY_swinit = false;
    var LMRY_swpnro = false;
    var idcurrencyUSD = 0;

    var ST_FEATURE = false;

    var featuresubs = runtime.isFeatureInEffect({
      feature: 'SUBSIDIARIES'
    });

    // Primera carga del pageInit
    var booPageIni = false;
    /**
     * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
     * @appliedtorecord recordType
     *
     * @param {String} type Access mode: create, copy, edit
     * @returns {Void}
     */

    function pageInit(context) {

      try {
        recordObj = context.currentRecord;
        type = context.mode;

        booPageIni = true;
        Language = scriptObj.getParameter({
          name: 'LANGUAGE'
        });

        Language = Language.substring(0, 2);
        LMRY_swinit = true;
        LMRY_swsubs = true;
        // Valida el Acceso
        var subsidiaria = recordObj.getValue({
          fieldId: 'subsidiary'
        });

        licenses = library.getLicenses(subsidiaria);

        Validate_Access(subsidiaria, recordObj);

        if (type == 'create' || type == 'copy') {

          var lmry_exchange_rate_field = recordObj.getField('custpage_lmry_exchange_rate');
          if(lmry_exchange_rate_field != null && lmry_exchange_rate_field != "") {
              lmry_exchange_rate_field.isDisplay = false;
          }

          var lmry_basecurrency = recordObj.getField('custpage_lmry_basecurrency');
          if (lmry_basecurrency != null && lmry_basecurrency != "") {
              lmry_basecurrency.isDisplay = false;
          }

          if (recordObj.getValue('entity') != '' && recordObj.getValue('entity') != null) {
            ws_exchange_rate();
          }
        }

        // Desactiva el campo
        var fieldObj = recordObj.getField({
          fieldId: 'custbody_lmry_subsidiary_country'
        });
        if (fieldObj != '' && fieldObj != null) {
          fieldObj.isDisabled = true;
        }

        if (library.getAuthorization(117, licenses) == false) {
          fieldObj = recordObj.getField({
            fieldId: 'custbody_lmry_reference_transaction'
          });
          if (fieldObj != '' && fieldObj != null) {
            fieldObj.isDisabled = true;
          }
          fieldObj = recordObj.getField({
            fieldId: 'custbody_lmry_reference_transaction_id'
          });
          if (fieldObj != '' && fieldObj != null) {
            fieldObj.isDisabled = true;
          }
        }


        if (type == 'create' || type == 'copy') {
          // Campos WHT Peru
          recordObj.setValue({
            fieldId: 'custbody_lmry_wtax_rate',
            value: 0
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_wtax_amount',
            value: 0
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_wbase_amount',
            value: 0
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_wtax_code',
            value: ''
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_scheduled_process',
            value: false
          });
        }


        // Solo para cuando es nuevo y se copia
        if (type == 'copy') {
          // Tipo de Documento - Serie  - Numero - Folio
          recordObj.setValue({
            fieldId: 'tranid',
            value: ''
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_transaction_type_doc',
            value: ''
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_document_type',
            value: ''
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_serie_doc_cxp',
            value: ''
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_num_preimpreso',
            value: ''
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_foliofiscal',
            value: ''
          });
          // Documentos de Referencia
          recordObj.setValue({
            fieldId: 'custbody_lmry_doc_serie_ref',
            value: ''
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_num_doc_ref',
            value: ''
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_doc_ref_date',
            value: ''
          });
          // Campos WHT Ecuador
          recordObj.setValue({
            fieldId: 'custbody_lmry_ec_base_rate0',
            value: 0
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_ec_base_rate12',
            value: 0
          });
          recordObj.setValue({
            fieldId: 'custbody_lmry_ec_base_rate14',
            value: 0
          });

          // Monto en letras
          recordObj.setValue({
            fieldId: 'custbody_lmry_pa_monto_letras',
            value: ''
          });

        }

        if (type == 'create') {
          // Seteo de CustomField WHT
          SetCustomField_WHT_Code_VC(recordObj);
        }

        //Logica de Tipo de Cambio Automatica
        var al_country = recordObj.getValue({
          fieldId: 'custbody_lmry_subsidiary_country'
        });

        if (LMRY_countr[0] == 'AR') {
          if ((context.mode == 'create' || context.mode == 'copy') && library.getAuthorization(532, licenses)) {
            if (subsidiaria != null && subsidiaria != '') {
              library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
            }
          }
        }
        if (LMRY_countr[0] == 'BR') {
          if ((context.mode == 'create' || context.mode == 'copy') && library.getAuthorization(529, licenses)) {
            if (subsidiaria != null && subsidiaria != '') {
              library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
            }
          }
        }
        if (LMRY_countr[0] == 'CO') {
          if ((context.mode == 'create' || context.mode == 'copy') && library.getAuthorization(533, licenses)) {
            if (subsidiaria != null && subsidiaria != '') {
              library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
            }
          }
        }
        if (LMRY_countr[0] == 'CL') {
          if ((context.mode == 'create' || context.mode == 'copy') && library.getAuthorization(530, licenses)) {
            if (subsidiaria != null && subsidiaria != '') {
              library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
            }
          }
        }
        if (LMRY_countr[0] == 'MX') {
          if ((context.mode == 'create' || context.mode == 'copy') && library.getAuthorization(528, licenses)) {
            if (subsidiaria != null && subsidiaria != '') {
              library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
            }
          }
        }
        if (LMRY_countr[0] == 'PE') {
          if ((context.mode == 'create' || context.mode == 'copy') && library.getAuthorization(531, licenses)) {
            if (subsidiaria != null && subsidiaria != '') {
              library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
            }
          }
        }


        // Solo localizaciones Peruanas
        if (LMRY_countr[0] == 'PE' && LMRY_access == true) {

          var tipTra = scriptObj.getParameter({
            name: 'custscript_lrmy_bill_credit'
          });
          if (tipTra != null && tipTra != '') {
            recordObj.setValue({
              fieldId: 'custbody_lmry_transaction_type_doc',
              value: parseInt(tipTra)
            });
            fieldObj = recordObj.getField({
              fieldId: 'custbody_lmry_transaction_type_doc'
            });
            if (fieldObj != '' && fieldObj != null) {
              fieldObj.isDisabled = true;
            }
          }


          // Muestra los campos por transaccion
          Get_Fields_PE(recordObj);

          LMRY_swinit = false;
        }

      } catch (err) {
        recordObj = context.currentRecord;
        library.sendemail2(' [ PageInit ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }

      booPageIni = false;
    }

    /**
     * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
     * @appliedtorecord recordType
     *
     * @returns {Boolean} True to continue save, false to abort save
     */
    function saveRecord(context) {
      try {

        recordObj = context.currentRecord;

        // if(type == 'create' && LMRY_countr[0] == 'PE'){
        //   var valida = ValidateAccount(recordObj);
        //   if(!valida){
        //     return false;
        //   }
        // }
        if (type == 'edit' && LMRY_countr[0] == 'MX') {
          if (flag && library.getAuthorization(151, licenses) == true) {
            var aplicadoID = 0;
            var cantApply = recordObj.getLineCount({
              sublistId: 'apply'
            });
            for (var i = 0; i < cantApply; i++) {
              var aplica = recordObj.getSublistValue({
                sublistId: 'apply',
                fieldId: 'apply',
                line: i
              });
              if (aplica == 'T' || aplica == true) {
                aplicadoID = recordObj.getSublistValue({
                  sublistId: 'apply',
                  fieldId: 'internalid',
                  line: i
                });
                break;
              }
            }
            if (aplicadoID != 0) {
              var searchPay = search.create({
                type: 'vendorpayment',
                columns: ['internalid'],
                filters: [
                  ['voided', 'is', 'F'], 'AND', ['appliedtotransaction.internalidnumber', 'equalto', aplicadoID]
                ]
              });
              searchPay = searchPay.run().getRange(0, 1000);
              if (searchPay != '' && searchPay != null) {
                alert(libAlert.getAlert(12, Language, []));
                return false;
              }
            }

          }
        }

        // Valida el Acceso
        var subsidiaria = recordObj.getValue({
          fieldId: 'subsidiary'
        });

        Validate_Access(subsidiaria, recordObj);

        if (Val_Campos.length > 0) {
          if (library2.Val_Mensaje(recordObj, Val_Campos) == false)
            return false;
        }
        // Inicializa campos WHT de sumatoria
        SetCustomField_WHT_Init_VC(recordObj);

        if (LMRY_access == true) {
          // Guarda Monto en Letras
          var imptotal = recordObj.getValue({
            fieldId: 'total'
          });
          var impletras = library1.ConvNumeroLetraESP(imptotal, '', '', 'Y');
          recordObj.setValue({
            fieldId: 'custbody_lmry_pa_monto_letras',
            value: impletras
          });
        }

        // Solo localizaciones Peruanas
        if (LMRY_countr[0] == 'PE') {
          if (library.getAuthorization(1, licenses) == true) {
            // Valida si existe un documento igual
            if (!validaDocumentosIguales()) {
              return false;
            }

            /*
             * ECM 23-07-13: Se actualiza campo oculto para que nunca cambie tipo de cambio de la
             * instancia a pesar de dar OK en mensaje estandar.
             */
            recordObj.setValue({
              fieldId: 'updatecurrency',
              value: ''
            });

            // Valida periodo contable
            var periodo = recordObj.getText({
              fieldId: 'postingperiod'
            });
            return confirm(libAlert.getAlert(15, Language, [periodo.toUpperCase()]));
          }
        }
      } catch (err) {
        recordObj = context.currentRecord;
        library.sendemail2(' [ saveRecord ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }
      return true;
    }

    /**
     * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
     * @appliedtorecord recordType
     *
     * @param {String} type Sublist internal id
     * @param {String} name Field internal id
     * @param {Number} linenum Optional line item number, starts from 1
     * @returns {Boolean} True to continue changing field value, false to abort value change
     */
    function validateField(context) {
      try {
        var sublist = context.sublistId;
        var lblname = context.fieldId;
        var linenum = context.line;
        recordObj = context.currentRecord;

        // Valida acceso y Seteo de CustomField WHT
        if (lblname == 'custbody_lmry_subsidiary_country') {

          booPageIni = true;

          var lmry_country = recordObj.getValue({
            fieldId: 'custbody_lmry_subsidiary_country'
          });
          if (lmry_country == null || lmry_country == '') {
            return true;
          }

          if (featuresubs == true || featuresubs == 'T') {
            var subs = recordObj.getValue({
              fieldId: 'subsidiary'
            });
            if (subs != '' && subs != null && subs !== undefined) {
              Validate_Access(subs, recordObj);
              SetCustomField_WHT_Code_VC(recordObj);
            }
          } else {
            Validate_Access(1, recordObj);
            SetCustomField_WHT_Code_VC(recordObj);
          }

          booPageIni = false;
          return true;
        }

        if (lblname == 'custbody_lmry_document_type' && booPageIni == false) {
          booPageIni = true;
          var tipDoc = recordObj.getValue({
            fieldId: 'custbody_lmry_document_type'
          });
          if (tipDoc != '' && tipDoc != null && tipDoc != -1) {

            if (Val_Campos.length > 0 && LMRY_access == true) {
              library2.Val_Authorization(recordObj, LMRY_countr[0], licenses);
            }
          }

          booPageIni = false
          return true;
        }

        //Logica de Tipo de Cambio Automatica
        if (lblname == 'currency') {
          var subsi = recordObj.getValue({
            fieldId: 'subsidiary'
          });
          var al_country = recordObj.getValue({
            fieldId: 'custbody_lmry_subsidiary_country'
          });
          if (subsi != null && subsi != '') {
            if (LMRY_countr[0] == 'AR') {
              if ((type == 'create' || type == 'copy') && library.getAuthorization(532, licenses)) {
                library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
              }
            }
            if (LMRY_countr[0] == 'BR') {
              if ((type == 'create' || type == 'copy') && library.getAuthorization(529, licenses)) {
                library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
              }
            }
            if (LMRY_countr[0] == 'CO') {
              if ((type == 'create' || type == 'copy') && library.getAuthorization(533, licenses)) {
                library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
              }
            }
            if (LMRY_countr[0] == 'CL') {
              if ((type == 'create' || type == 'copy') && library.getAuthorization(530, licenses)) {
                library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
              }
            }
            if (LMRY_countr[0] == 'MX') {
              if ((type == 'create' || type == 'copy') && library.getAuthorization(528, licenses)) {
                library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
              }
            }
            if (LMRY_countr[0] == 'PE') {
              if ((type == 'create' || type == 'copy') && library.getAuthorization(531, licenses)) {
                library_ExchRate.autosetExchRate(recordObj, al_country, 'purchase');
              }
            }
          }

        }

        // Solo si esta esta activo el Feature del pais
        if (LMRY_access == true && booPageIni == false) {
          booPageIni = true;
          Validate_Field(sublist, lblname, linenum, recordObj);
          booPageIni = false;
        }

      } catch (err) {
        recordObj = context.currentRecord;
        library.sendemail2(' [ validateField ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }
      return true;
    }

    function validateLine(context) {
      if (context.sublistId == 'item' || context.sublistId == 'expense') {
        flag = true;
        try {
          if (Val_Campos_Linea.length > 0) {
            if (library2.Val_Line(context.currentRecord, Val_Campos_Linea, context.sublistId) == false) {
              return false;
            } else {
              return true;
            }
          }
        } catch (err) {
          recordObj = context.currentRecord;
          library.sendemail2(' [ validateLine ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
        }
      }
      return true;
    }


    /* ------------------------------------------------------------------------------------------------------
     * Funcion Muestra Fields for Transaccions
     * --------------------------------------------------------------------------------------------------- */
    function Get_Fields_PE(recordObj) {
      var value = recordObj.getValue({
        fieldId: 'custbody_lmry_transaction_type_doc'
      }); // busca valor conforme nombre del campo

      /* Se realiza una busqueda para ver que campos se ocultan */
      //library.onFieldsHide([2],recordObj,false);

      /* Valida que no sea Nulo */
      if (value == '' || value == null) {
        return true;
      }

      /* Se realiza una busqueda para ver que campos se ocultan */
      // Filtros
      var filters = new Array();
      filters[0] = search.createFilter({
        name: 'custrecord_lmry_id_transaction',
        operator: search.Operator.IS,
        values: value
      });

      // Realiza un busqueda para mostrar los campos
      var hidefields = search.create({
        type: 'customrecord_lmry_transaction_fields',
        columns: ['custrecord_lmry_id_fields'],
        filters: filters
      });
      var hidefields = hidefields.run().getRange(0, 1000);
      if (hidefields != null && hidefields != '') {
        for (var i = 0; i < hidefields.length; i++) {
          var namefield = hidefields[i].getText('custrecord_lmry_id_fields');
          if (namefield != '' && namefield != null) {
            Field = recordObj.getField({
              fieldId: namefield
            });
            if (Field != null && Field != '') {
              Field.isDisplay = true;
            }
            //nlapiSetFieldDisplay(namefield, true);
          }
        }
      }
    }

    /* ------------------------------------------------------------------------------------------------------
     * Funcion setea los campos de cabecera
     * --------------------------------------------------------------------------------------------------- */
    function Get_Entity_Subsidiary() {
      try {
        // Valida si la subsidiaria tiene activa la funcionalidad

        var url = url.resolveScript({
          scriptId: 'customscript_lmry_get_subsidiary_stlt',
          deploymentId: 'customdeploy_lmry_get_subsidiary_stlt',
          returnExternalUrl: true
        });
        url += '&id=' + currentRecord.getValue({
          fieldId: 'entity'
        });
        var get = http.get({
          url: url
        });
        bod = get.body;

        // Valida si tiene acceso
        Validate_Access(bod, currentRecord.get());

        // Solo para Peru
        if (LMRY_countr[0] == 'PE' && LMRY_access == true) {

          var tipTra = scriptObj.getParameter({
            name: 'custscript_lrmy_bill_credit'
          });
          currentRecord.setValue({
            fieldId: 'custbody_lmry_transaction_type_doc',
            value: tipTra
          });
          Field = currentRecord.getField({
            fieldId: 'custbody_lmry_transaction_type_doc'
          });
          if (Field != '' && Field != null) {
            Field.isDisabled = true;
          }
        }
      } catch (err) {
        library.sendemail2(' [ Get_Entity_Subsidiary ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }
      return true;
    }

    /*
     *  Valida el cambio de campo
     */
    function Validate_Field(sublist, lblname, linenum, recordObj) {
      // Setea campos Latam
      try {
        /* ********************************************************
         * Transaccion Vendor Credit solo para los paises:
         * Peru, Chile y Ecuador
         * y que tenga acceso a LatamReady
         ******************************************************* */
        if (LMRY_countr[0] != 'PE' && LMRY_countr[0] != 'CL' && LMRY_countr[0] != 'EC' && LMRY_countr[0] != 'UY') {
          return true;
        }

        /*if (lblname == 'entity' && recordObj.getValue({
            fieldId: 'entity'
          }) != '') {
          ValidateAccount(recordObj);
          return true;
        }*/

        if (LMRY_countr[0] == 'PE' && lblname == 'custbody_lmry_transaction_type_doc') {
          Get_Fields_PE(recordObj);
        }

        if (lblname == 'custbody_lmry_serie_doc_cxp' || lblname == 'custbody_lmry_num_preimpreso' || lblname == 'custbody_lmry_document_type') {

          var tipDoc = recordObj.getValue({
            fieldId: 'custbody_lmry_document_type'
          });
          if (tipDoc != '' && tipDoc != null && tipDoc != -1) {
            var tipini = search.lookupFields({
              type: 'customrecord_lmry_tipo_doc',
              id: tipDoc,
              columns: ['custrecord_lmry_doc_initials']
            });
            if (tipini.custrecord_lmry_doc_initials == '' || tipini.custrecord_lmry_doc_initials == null) {
              tipini.custrecord_lmry_doc_initials = '';
            }
            var texto = tipini.custrecord_lmry_doc_initials.toUpperCase() + ' ' +
              recordObj.getValue({
                fieldId: 'custbody_lmry_serie_doc_cxp'
              }) + '-' +
              recordObj.getValue({
                fieldId: 'custbody_lmry_num_preimpreso'
              });
            recordObj.setValue({
              fieldId: 'tranid',
              value: texto
            });

            // Sale de la funcion
            return true;
          }
        }
        if (sublist == 'item' && lblname == 'item') {
          var proveedor = recordObj.getValue({
            fieldId: 'entity'
          });
          if (proveedor == '' || proveedor == null) {
            alert(libAlert.getAlert(13, Language, []));
            return false;
          } else {
            return true;
          }
        }
      } catch (err) {
        library.sendemail2(' [ Validate_Field ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }

      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Funcion Inicializa campos WHT de sumatoria
     * --------------------------------------------------------------------------------------------------- */
    function SetCustomField_WHT_Init_VC(recordObj) {
      // Solo para subsidiria de Bolivia, Colombia y Paraguay
      if (LMRY_countr[0] != 'BO' && LMRY_countr[0] != 'CO' && LMRY_countr[0] != 'PY') {
        return true;
      }

      // Latam Colombia
      recordObj.setValue({
        fieldId: 'custbody_lmry_co_reteica_amount',
        value: 0
      });
      recordObj.setValue({
        fieldId: 'custbody_lmry_co_reteiva_amount',
        value: 0
      });
      recordObj.setValue({
        fieldId: 'custbody_lmry_co_retefte_amount',
        value: 0
      });
      recordObj.setValue({
        fieldId: 'custbody_lmry_co_retecree_amount',
        value: 0
      });
      // Latam Bolivia
      recordObj.setValue({
        fieldId: 'custbody_lmry_bo_autoreteit_whtamount',
        value: 0
      });
      recordObj.setValue({
        fieldId: 'custbody_lmry_bo_reteiue_whtamount',
        value: 0
      });
      // Latam Paraguay
      recordObj.setValue({
        fieldId: 'custbody_lmry_py_autoreteir_amount',
        value: 0
      });
      recordObj.setValue({
        fieldId: 'custbody_lmry_py_reteiva_amount',
        value: 0
      });
    }

    /* ------------------------------------------------------------------------------------------------------
     * Funcion setea los campos de cabecera
     * --------------------------------------------------------------------------------------------------- */
    function SetCustomField_WHT_Code_VC(recordObj) {
      try {
        // Solo para subsidiria de Bolivia, Colombia y Paraguay
        if (LMRY_countr[0] != 'BO' && LMRY_countr[0] != 'CO' && LMRY_countr[0] != 'PY') {
          return true;
        }

        // Latam Colombia
        recordObj.setValue({
          fieldId: 'custbody_lmry_co_reteica',
          value: ''
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_co_reteica_amount',
          value: 0
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_co_reteiva',
          value: ''
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_co_reteiva_amount',
          value: 0
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_co_retefte',
          value: ''
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_co_retefte_amount',
          value: 0
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_co_autoretecree',
          value: ''
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_co_retecree_amount',
          value: 0
        });
        // Latam Bolivia
        recordObj.setValue({
          fieldId: 'custbody_lmry_bo_autoreteit',
          value: ''
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_bo_autoreteit_whtamount',
          value: 0
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_bo_reteiue',
          value: ''
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_bo_reteiue_whtamount',
          value: 0
        });
        // Latam Paraguay
        recordObj.setValue({
          fieldId: 'custbody_lmry_py_autoreteir',
          value: ''
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_py_autoreteir_amount',
          value: 0
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_py_reteiva',
          value: ''
        });
        recordObj.setValue({
          fieldId: 'custbody_lmry_py_reteiva_amount',
          value: 0
        });

        // Busca al cliente
        var lmry_entity = recordObj.getValue({
          fieldId: 'entity'
        });
        if (lmry_entity != '' && lmry_entity != null) {
          /**********************************
           *		Valida que no este nulo
           **********************************/
          //PY47-BO46-CO27-EC41
          // Solo para subsidiria de Bolivia
          if (LMRY_countr[0] == 'BO') {
            var auth = library.getAuthorization(27, licenses);
            if (auth == true || auth == 'T') {
              // Seteo de campos
              var rec_entity = search.lookupFields({
                type: 'entity',
                id: lmry_entity,
                columns: ['custentity_lmry_bo_autoreteit', 'custentity_lmry_bo_reteiue']
              });
              /**********************************
               *		Valida que no este nulo
               **********************************/
              // Latam Bolivia
              if (rec_entity.custentity_lmry_bo_autoreteit != '' && rec_entity.custentity_lmry_bo_autoreteit != null && rec_entity.custentity_lmry_bo_autoreteit != undefined) {
                recordObj.setValue({
                  fieldId: 'custbody_lmry_bo_autoreteit',
                  value: rec_entity.custentity_lmry_bo_autoreteit[0].value
                });
              }
              if (rec_entity.custentity_lmry_bo_reteiue != '' && rec_entity.custentity_lmry_bo_reteiue != null && rec_entity.custentity_lmry_bo_reteiue != undefined) {
                recordObj.setValue({
                  fieldId: 'custbody_lmry_bo_reteiue',
                  value: rec_entity.custentity_lmry_bo_reteiue[0].value
                });
              }
            }

          }
          // Solo para subsidiria de Colombia
          if (LMRY_countr[0] == 'CO') {
            var auth = library.getAuthorization(27, licenses);
            if (auth == true || auth == 'T') {
              // Seteo de campos
              var rec_entity = search.lookupFields({
                type: 'entity',
                id: lmry_entity,
                columns: ['custentity_lmry_co_reteica', 'custentity_lmry_co_reteiva',
                  'custentity_lmry_co_retefte', 'custentity_lmry_co_retecree'
                ]
              });
              /**********************************
               *		Valida que no este nulo
               **********************************/
              if (rec_entity.custentity_lmry_co_reteica != '' && rec_entity.custentity_lmry_co_reteica != null && rec_entity.custentity_lmry_co_reteica != undefined) {
                recordObj.setValue({
                  fieldId: 'custbody_lmry_co_reteica',
                  value: rec_entity.custentity_lmry_co_reteica[0].value
                });
              }
              if (rec_entity.custentity_lmry_co_reteiva != '' && rec_entity.custentity_lmry_co_reteiva != null && rec_entity.custentity_lmry_co_reteiva != undefined) {
                recordObj.setValue({
                  fieldId: 'custbody_lmry_co_reteiva',
                  value: rec_entity.custentity_lmry_co_reteiva[0].value
                });
              }
              if (rec_entity.custentity_lmry_co_retefte != '' && rec_entity.custentity_lmry_co_retefte != null && rec_entity.custentity_lmry_co_retefte != undefined) {
                recordObj.setValue({
                  fieldId: 'custbody_lmry_co_retefte',
                  value: rec_entity.custentity_lmry_co_retefte[0].value
                });
              }
              if (rec_entity.custentity_lmry_co_retecree != '' && rec_entity.custentity_lmry_co_retecree != null && rec_entity.custentity_lmry_co_retecree != undefined) {
                recordObj.setValue({
                  fieldId: 'custbody_lmry_co_autoretecree',
                  value: rec_entity.custentity_lmry_co_retecree[0].value
                });
              }
            }

          }
          // Solo para subsidiria de Paraguay
          if (LMRY_countr[0] == 'PY') {
            var auth = library.getAuthorization(47, licenses);
            if (auth == true || auth == 'T') {
              // Seteo de campos
              var rec_entity = search.lookupFields({
                type: 'entity',
                id: lmry_entity,
                columns: ['custentity_lmry_py_autoreteir', 'custentity_lmry_py_reteiva']
              });
              /**********************************
               *		Valida que no este nulo
               **********************************/
              // Latam Paraguay
              if (rec_entity.custentity_lmry_py_autoreteir != '' && rec_entity.custentity_lmry_py_autoreteir != null && rec_entity.custentity_lmry_py_autoreteir != undefined) {
                recordObj.setValue({
                  fieldId: 'custbody_lmry_py_autoreteir',
                  value: rec_entity.custentity_lmry_py_autoreteir[0].value
                });
              }
              if (rec_entity.custentity_lmry_py_reteiva != '' && rec_entity.custentity_lmry_py_reteiva != null && rec_entity.custentity_lmry_py_reteiva != undefined) {
                recordObj.setValue({
                  fieldId: 'custbody_lmry_py_reteiva',
                  value: rec_entity.custentity_lmry_py_reteiva[0].value
                });
              }
            }

          }
        }
      } catch (err) {
        library.sendemail2(' [ SetCustomField_WHT_Code_VC ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }

      return true;
    }

    /*
     * Valida si el tipo de documento tiene una Cta Contable asignada
     */
    function ValidateAccount(recordObj) {
      var swexits = false;
      var proveedor = recordObj.getValue({
        fieldId: 'entity'
      });
      var tipDoc = recordObj.getValue({
        fieldId: 'custbody_lmry_document_type'
      });
      if (proveedor == '' || proveedor == null || tipDoc == '' || tipDoc == null || tipDoc == -1) {
        return swexits;
      }
      var tipoMoneda = recordObj.getValue({
        fieldId: 'currency'
      });
      var esPersona = search.lookupFields({
        type: 'vendor',
        id: proveedor,
        columns: ['isperson']
      });
      var esEmpresa;
      if (esPersona.isperson == false || esPersona.isperson == 'F') {
        esEmpresa = 'T';
      } else {
        esEmpresa = 'F';
      }

      var filter = new Array();
      filter[0] = search.createFilter({
        name: 'isinactive',
        operator: search.Operator.IS,
        values: 'F'
      });
      filter[1] = search.createFilter({
        name: 'custrecord_config_es_empresa',
        operator: search.Operator.IS,
        values: esEmpresa
      });
      filter[2] = search.createFilter({
        name: 'custrecord_config_moneda',
        operator: search.Operator.IS,
        values: tipoMoneda
      });
      filter[3] = search.createFilter({
        name: 'custrecord_config_tipo_doc_cxp',
        operator: search.Operator.IS,
        values: tipDoc
      });

      var searchresults = search.create({
        type: 'customrecord_lmry_config_acc_vendor',
        columns: ['custrecord_config_cuenta_contable'],
        filters: filter
      });
      var searchresults = searchresults.run().getRange(0, 1000);
      if (searchresults == null || searchresults == '') {
        swexits = false;
        /*recordObj.setValue({fieldId:'entity', value:''});
        alert('No se ha configurado una cuenta contable para este tipo de documento');*/
        // nlapiSetFieldValue('entity', '');
        // swexits = false;

        alert('No se ha configurado una cuenta contable para este tipo de documento');

      } else {
        recordObj.setValue({
          fieldId: 'account',
          value: searchresults[0].getValue('custrecord_config_cuenta_contable')
        });
        swexits = true;
      }
      return swexits;
    }

    /*
     * Valida que el documento sea el unico
     */
    function validaDocumentosIguales() {
      var exist = true;
      try {
        var recordObj = currentRecord.get();
        var idtransac = recordObj.id;
        var proveedor = recordObj.getValue({
          fieldId: 'entity'
        });
        tipoDoc = recordObj.getValue({
          fieldId: 'custbody_lmry_document_type'
        });
        var nroSerie = recordObj.getValue({
          fieldId: 'custbody_lmry_serie_doc_cxp'
        });
        var nroDoc = recordObj.getValue({
          fieldId: 'custbody_lmry_num_preimpreso'
        });
        var subsidia = recordObj.getValue({
          fieldId: 'subsidiary'
        });

        if (proveedor != '' &&
          (tipoDoc != '' && tipoDoc != null && tipoDoc != -1) &&
          (nroSerie != '' && nroSerie != null && nroSerie != -1) &&
          (nroDoc != '' && nroDoc != null)) {

          var filters = new Array();
          filters[0] = search.createFilter({
            name: 'mainline',
            operator: search.Operator.IS,
            values: 'T'
          });
          filters[1] = search.createFilter({
            name: 'entity',
            operator: search.Operator.IS,
            values: proveedor
          });
          filters[2] = search.createFilter({
            name: 'custbody_lmry_document_type',
            operator: search.Operator.IS,
            values: tipoDoc
          });
          filters[3] = search.createFilter({
            name: 'custbody_lmry_serie_doc_cxp',
            operator: search.Operator.IS,
            values: nroSerie
          });
          filters[4] = search.createFilter({
            name: 'custbody_lmry_num_preimpreso',
            operator: search.Operator.IS,
            values: nroDoc
          });
          // Valida si es OneWorld
          if (featuresubs) {
            filters[5] = search.createFilter({
              name: 'subsidiary',
              operator: search.Operator.IS,
              values: subsidia
            });
          }
          var searchresults = search.create({
            type: 'vendorcredit',
            columns: ['internalid'],
            filters: filters
          });
          var searchresults = searchresults.run().getRange(0, 1000);
          if (searchresults != null && searchresults != '') {
            // Se valida que no sea el mismo registro
            if (idtransac == searchresults[0].getValue('internalid')) {
              exist = true;
            } else {
              alert(libAlert.getAlert(14, Language, []));

              exist = false;
            }
          }
        }
      } catch (err) {
        library.sendemail2(' [ validaDocumentosIguales ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }
      return exist;
    }

    /* ------------------------------------------------------------------------------------------------------
     * Al momento de cambiar el campo entity se va hacer una recarga a la paguina pasando de datos
     * subsidiary, customform y entity.
     * --------------------------------------------------------------------------------------------------- */
    function fieldChanged(scriptContext) {

      ST_FEATURE = runtime.isFeatureInEffect({
        feature: "tax_overhauling"
      });

      recordObj = scriptContext.currentRecord;
      var name = scriptContext.fieldId;
      var sublist = scriptContext.sublistId;

      if (name == 'currency' && (type == 'create' || type == 'copy')) {

        var lmry_exchange_rate_field = recordObj.getField('custpage_lmry_exchange_rate');
        if (lmry_exchange_rate_field != null && lmry_exchange_rate_field != '') {
          ws_exchange_rate();
        }
        return true;
      }

      if (name == 'custpage_lmry_exchange_rate' && (type == 'create' || type == 'copy')) {

        var lmry_exchange_rate = recordObj.getValue('custpage_lmry_exchange_rate');
        if (lmry_exchange_rate != ' ' && lmry_exchange_rate != '' && lmry_exchange_rate != null) {
          recordObj.setValue('exchangerate', lmry_exchange_rate);
        }
        return true;
      }

      if (name == 'trandate' && (type == 'create' || type == 'copy')) {
        if (recordObj.getValue('entity') != '' && recordObj.getValue('entity') != null) {
          ws_exchange_rate();
        }
        return true;
      }

      if (featuresubs == true || featuresubs == 'T') {
        if (name == 'entity' && type == 'create') {
          var cf = recordObj.getValue('customform');
          var ent = recordObj.getValue('entity');

          if (ent != '' && ent != null && ent != -1 && cf != '' && cf != null && cf != -1) {

            var objSearch = search.lookupFields({
              type: 'entity',
              id: ent,
              columns: ['subsidiary']
            });

            var sub = objSearch.subsidiary[0].value;

            setWindowChanged(window, false);
            window.location.href = window.location.href.split('?')[0] + '?whence=&cf=' + cf + '&entity=' + ent + '&subsidiary=' + sub;
          }
          return true;
        }

        if (name == 'subsidiary' && type == 'create') {
          var cf = recordObj.getValue('customform');
          var ent = recordObj.getValue('entity');
          var sub = recordObj.getValue('subsidiary');

          if (ent != '' && ent != null && ent != -1 && cf != '' && cf != null && cf != -1 && sub != '' && sub != null && sub != -1) {

            setWindowChanged(window, false);
            window.location.href = window.location.href.split('?')[0] + '?whence=&cf=' + cf + '&entity=' + ent + '&subsidiary=' + sub;
          }
          return true;
        }
      }

      if (ST_FEATURE === true || ST_FEATURE === "T") {
        ST_ConfigFields.setInvoicingIdentifier(recordObj);
      }


      //SETEO DE CFOP AUTOMATICO CUANDO ESTA LLENO EN EL ITEM
      if (LMRY_countr[0] == 'BR' && LMRY_access == true) {
        var flagCFOP = true;
        if (sublist == 'item' && name == 'item') {
          var idItem = recordObj.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item'
          });
          if (idItem) {
            var typeTransaction = recordObj.getValue('type');
            var itemCFOP = search.lookupFields({
              type: 'item',
              id: idItem,
              columns: ['custitem_lmry_br_cfop_inc', 'custitem_lmry_br_cfop_display_inc', 'custitem_lmry_br_cfop_out', 'custitem_lmry_br_cfop_display_out']
            });

            var currentCFOPDisplay = recordObj.getCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_tran_outgoing_cfop_di'
            });
            var currentCFOP = recordObj.getCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_tran_outgoing_cfop'
            });

            if (!currentCFOPDisplay && itemCFOP.custitem_lmry_br_cfop_display_inc != null && itemCFOP.custitem_lmry_br_cfop_display_inc != '') {
              recordObj.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_lmry_br_tran_outgoing_cfop_di',
                value: itemCFOP.custitem_lmry_br_cfop_display_inc,
                ignoreFieldChange: true
              });
            }
            if (!currentCFOP && itemCFOP['custitem_lmry_br_cfop_inc'] && itemCFOP['custitem_lmry_br_cfop_inc'].length > 0) {
              flagCFOP = false;

              var nameCFOP = search.lookupFields({
                type: 'customrecord_lmry_br_cfop_codes',
                id: itemCFOP.custitem_lmry_br_cfop_inc[0].value,
                columns: ['custrecord_lmry_br_cfop_description']
              });
              nameCFOP = nameCFOP.custrecord_lmry_br_cfop_description;

              if (nameCFOP) {
                recordObj.setCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_lmry_br_tran_outgoing_cfop_di',
                  value: nameCFOP,
                  ignoreFieldChange: true
                });
              }

              recordObj.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_lmry_br_tran_outgoing_cfop',
                value: itemCFOP.custitem_lmry_br_cfop_inc[0].value,
                ignoreFieldChange: true
              });

            }



          }
        }

        if (sublist == 'item' && name == 'custcol_lmry_br_tran_outgoing_cfop' && flagCFOP == true) {
          var cfop = recordObj.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_tran_outgoing_cfop'
          });
          if (cfop) {
            var nameCFOP = search.lookupFields({
              type: 'customrecord_lmry_br_cfop_codes',
              id: cfop,
              columns: ['custrecord_lmry_br_cfop_description']
            });
            nameCFOP = nameCFOP.custrecord_lmry_br_cfop_description;

            if (nameCFOP) {
              recordObj.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_lmry_br_tran_outgoing_cfop_di',
                value: nameCFOP,
                ignoreFieldChange: true
              });
            }

            recordObj.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_tran_outgoing_cfop',
              value: cfop,
              ignoreFieldChange: true
            });

          }

        }

        flagCFOP = true;

      } //FIN CFOP



      return true;
    }

    /* ------------------------------------------------------------------------------------------------------
     * A la variable featureId se le asigna el valore que le corresponde
     * --------------------------------------------------------------------------------------------------- */
    function Validate_Access(subsiID) {
      try {
        // Oculta todos los campos LMRY
        //library.onFieldsHide(2, recordObj);

        if (subsiID == '' || subsiID == null) {
          return true;
        }

        // Inicializa variables Locales y Globales
        LMRY_access = false;
        LMRY_countr = library.Get_Country_STLT(subsiID);

        if (LMRY_countr.length < 1) {
          return true;
        }

        LMRY_access = library.getCountryOfAccess(LMRY_countr, licenses);

        if (LMRY_countr[0] == '' || LMRY_countr[0] == null) {
          return true;
        }

        // Solo si tiene acceso
        Val_Campos = '';
        if (LMRY_access == true) {
          //library.onFieldsDisplayBody(recordObj, LMRY_countr[1], 'custrecord_lmry_on_vendor_credit', false);
          Val_Campos = library2.Val_Authorization(recordObj, LMRY_countr[0], licenses);
          Val_Campos_Linea = library2.Val_Line_Busqueda(recordObj, LMRY_countr[0], licenses);
        }

        // Ya paso por esta validacion
        LMRY_swsubs = false;
      } catch (err) {
        library.sendemail2(' [ Validate_Access ] ' + err, LMRY_script, recordObj, 'transactionnumber', 'entity');
      }
      return true;
    }

    function removeOtions(id, rcd) {
      var field = rcd.getField(id);
      field.removeSelectOption({
        value: null,
      });
    }

    function addOptions(id, rcd, values) {

      var field = rcd.getField(id);
      field.insertSelectOption({
        value: ' ',
        text: '\u2000'
      });

      field.insertSelectOption({
        value: values[0]["compra"],
        text: 'Compra',
      });

      field.insertSelectOption({
        value: values[0]["venta"],
        text: 'Venta',
      });

    }

    function ws_exchange_rate() {

      try {

        var er_code_country = recordObj.getValue('nexus_country');

        if (er_code_country != '' && er_code_country != null) {

          var fe_exrate = feature_ws_exchange_rate(er_code_country);

          if (fe_exrate == true) {

            var currencySearch = search.create({
              type: search.Type.CURRENCY,
              filters: ['symbol', 'is', 'USD'],
              columns: 'internalid'
            });
            var currencySearch = currencySearch.run().getRange(0, 1000);
            idcurrencyUSD = currencySearch[0].getValue('internalid');

            if (currencySearch.length > 0) {

              //Moneda Principal Inicio
              var featuresubs = runtime.isFeatureInEffect({
                feature: 'SUBSIDIARIES'
              });

              if (featuresubs == true || featuresubs == 'T') {
                var primaryCurrency = search.lookupFields({
                  type: 'subsidiary',
                  id: recordObj.getValue('subsidiary'),
                  columns: ['currency']
                });

                var primaryCurrencyId = primaryCurrency.currency[0].value;
              } else {
                var primaryCurrencyId = Number(recordObj.getValue('custpage_lmry_basecurrency'));
              };

              if (primaryCurrencyId != idcurrencyUSD && recordObj.getValue('currency') == idcurrencyUSD) {

                result_ws_exchange_rate(er_code_country, 1);
                var lmry_exchange_rate_field = recordObj.getField('custpage_lmry_exchange_rate');
                if (lmry_exchange_rate_field != null && lmry_exchange_rate_field != "") {
                    lmry_exchange_rate_field.isDisplay = true;
                }
              } else if (primaryCurrencyId == idcurrencyUSD && recordObj.getValue('currency') != idcurrencyUSD) {

                var secondaryCurrency = search.lookupFields({
                  type: 'currency',
                  id: recordObj.getValue('currency'),
                  columns: ['symbol']
                });

                var codeCurrency = secondaryCurrency.symbol;

                var codeCountry = {
                  'PEN': 'PE',
                  'CRC': 'CR',
                  'ARS': 'AR',
                  'BRL': 'BR',
                  'MXN': 'MX',
                  'COP': 'CO',
                  'USD': 'US',
                  'BOB': 'BO',
                  'USD': 'EC',
                  'USD': 'SV',
                  'GTQ': 'GT',
                  'NIO': 'NI',
                  'PAB': 'PA',
                  'PYG': 'PY',
                  'DOP': 'DO',
                  'UYU': 'UY',
                  'CLP': 'CL'
                };

                var lmry_exchange_rate_field = recordObj.getField('custpage_lmry_exchange_rate');
                if (lmry_exchange_rate_field != null && lmry_exchange_rate_field != "") {
                    lmry_exchange_rate_field.isDisplay = true;
                }
                result_ws_exchange_rate(codeCountry[codeCurrency], 2);

              } else {
                var lmry_exchange_rate_field = recordObj.getField('custpage_lmry_exchange_rate');
                if (lmry_exchange_rate_field != null && lmry_exchange_rate_field != "") {
                    lmry_exchange_rate_field.isDisplay = false;
                }
              }
            }
          }
        }

      } catch (err) {
        library.sendemail2(' [ ws_exchange_rate ] ' + err, LMRY_script, recordObj, 'tranid', 'entity');
      }

    }

    function result_ws_exchange_rate(er_code_country, exchange_rate_case) {

      var er_trandate = recordObj.getValue('trandate');
      if (er_code_country != '' && er_code_country != null && er_trandate != '' && er_trandate != null) {

        if (exchange_rate_case == 1) {

          var result = LR_webService.conection('clnt', 'getExchangeRate', {
            "from": er_code_country,
            "to": "US",
            "date": er_trandate.getDate() + "/" + (er_trandate.getMonth() + 1) + "/" + er_trandate.getFullYear()
          });

        } else if (exchange_rate_case == 2) {

          var result = LR_webService.conection('clnt', 'getExchangeRate', {
            "from": "US",
            "to": er_code_country,
            "date": er_trandate.getDate() + "/" + (er_trandate.getMonth() + 1) + "/" + er_trandate.getFullYear()
          });
        }

        if (result.length > 0) {
          removeOtions('custpage_lmry_exchange_rate', recordObj);
          addOptions('custpage_lmry_exchange_rate', recordObj, result);
        }
      }
    }

    function feature_ws_exchange_rate(code_countr) {
      var autfe = false;
      var authorizations_fe = {
        'AR': 610,
        'BO': 611,
        'BR': 612,
        'CL': 613,
        'CO': 614,
        'CR': 615,
        'DO': 624,
        'EC': 616,
        'SV': 617,
        'GT': 618,
        'MX': 619,
        'NI': 620,
        'PA': 621,
        'PY': 622,
        'PE': 623,
        'UY': 625
      };

      if (authorizations_fe[code_countr]) {
        autfe = library.getAuthorization(authorizations_fe[code_countr], licenses);
      }

      return autfe;
    }

    return {
      pageInit: pageInit,
      fieldChanged: fieldChanged,
      /*postSourcing: postSourcing,
      sublistChanged: sublistChanged,
      lineInit: lineInit,*/
      validateField: validateField,
      //funcionCancel: funcionCancel,
      validateLine: validateLine,
      /*validateInsert: validateInsert,
      validateDelete: validateDelete,*/
      saveRecord: saveRecord
    };

  });
