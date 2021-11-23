/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
  ||   This script for customer center (Time)                     ||
  ||                                                              ||
  ||  File Name: LMRY_BR_EI_TAXC_LBRY_V2.0.js                     ||
  ||                                                              ||
  ||  Version Date         Author        Remarks                  ||
  ||  2.0     Jan 07 2020  LatamReady    Use Script 2.0           ||
  \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NModuleScope Public
 * @NApiVersion 2.x
 */
define(["N/search", "N/runtime", "N/record", "N/redirect", "N/log", "N/format", "N/file", "N/email", "N/http", "N/https", "N/url", "N/config", "./LMRY_BR_EI_TAXRESULT_LBRY_V2.0.js"],

  function(search, runtime, record, redirect, log, format, file, email, http, https, url, config, library_taxtrans) {

    var LMRY_script = "LatamReady - BR EI Tax Calculator LBRY V2.0";

    var tpNF = '';
    var xmlEnvio = '';
    var exito = false;
    var arr_item = [];
    var rec;
    var flag = false;
    var internalId = '';
    var subsiTransac = '';
    var tranID = '';
    // var location = '';
    var subsi = '';
    // var customer_id = '';
    var nameTypeDoc = '';
    var mensajeError = '';
    var status_doc = '';
    var logicFlag = null;
    var doc_type = '';
    var prodEnviron = false;
    var txn_type = '';
    var TransacOther = '';
    var TransacOther_type = '';

    var SESSIONID = '';
    var SISORIG = '';
    var URL_WS = '';
    var NATOP = '';
    var UFORIG = '';
    var UFDEST = '';
    var CHAVE_BANCO = '';
    var DTCALC = '';
    var PERFILREM = [];
    var PERFILDEST = [];
    var CHECK_ITEM_TYPE = '';
    var USER = '';
    var PASSWORD = '';
    var check_baseNCM = false;
    var currentUser = '';
    // var TransacOther = '';

    var SEARCH = search;
    var RUNTIME = runtime;
    var RECORD = record;
    var REDIRECT = redirect;
    var LOG = log;
    var FORMAT = format;
    var FILE = file;
    var EMAIL = email;
    var HTTP = http;
    var HTTPS = https;
    var URL = url;
    var CONFIG = config;

    function calculateTaxes(_rec) {
      try {

        LOG.error("INICIO", "INICIO");
        rec = _rec;
        internalId = rec.id; //_doc_id;
        doc_type = rec.type; //_doc_type;
        subsiTransac = rec.getValue('subsidiary');
        tranID = rec.getValue('tranid');
        txn_type = rec.getValue('custbody_lmry_br_transaction_type');
        TransacOther = rec.getValue('createdfrom');
        TransacOther_type = rec.getValue('ordertype');
        var configCompany = CONFIG.load({
          type: CONFIG.Type.COMPANY_INFORMATION
        });
        var accountID = configCompany.getValue('companyid');
        if (accountID.indexOf('_SB') == -1 && accountID.indexOf('TSTDRV') == -1) {
          prodEnviron = true;
        }

        if (['invoice', 'salesorder', 'estimate', 'itemfulfillment'].indexOf(doc_type) != -1) {
          tpNF = 1;
        } else if (['vendorbill', 'purchaseorder', 'itemreceipt'].indexOf(doc_type) != -1) {
          tpNF = 0;
        } else if (['creditmemo', 'vendorcredit'].indexOf(doc_type) != -1) {
          tpNF = 4;
        }

        var scriptObj = RUNTIME.getCurrentScript();
        currentUser = scriptObj.getParameter({
          name: 'custscript_lmry_br_email_emp_e'
        });

        var location = '';
        if (doc_type == 'itemfulfillment' || doc_type == 'vendorbill' || doc_type == 'vendorcredit') {
          location = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            line: 0
          });
        } else {
          location = rec.getValue('location');
        }

        if (location == '' || location == null) {
          mensajeError = "Location was not chosen in the transaction.";
          status_doc = "Error";
          logError(status_doc, mensajeError);
          return exito;
        }

        DTCALC = FormatoYYYYMMDD(rec.getValue('trandate'));
        var customer_id = rec.getValue('entity');
        var TypeDoc = rec.getValue('custbody_lmry_document_type');
        if (TypeDoc == null || TypeDoc == '') {
          mensajeError = "Document type was not chosen in the transaction.";
          status_doc = "Error";
          logError(status_doc, mensajeError);
          return exito;
        }

        nameTypeDoc = SEARCH.lookupFields({
          type: 'customrecord_lmry_tipo_doc',
          id: TypeDoc,
          columns: ['name']
        }).name;

        //Obtiene features del SETUP
        if (getEnableFeatures()) {

          //Obtener los fields de los items que utilizaremos en la llamada del WS
          if (ObtenerCamposPorItem()) {

            //Si "flag" continua en false, significa que no existen items inventariables
            if (flag) {
              LOG.error("There are items");

              //Completar los campos que enviaremos en el WS Calcular a nivel:
              getAddressFields(location);
              if (UFORIG == '' || UFORIG == null) {
                mensajeError = "The field 'LATAM - PROVINCE' was not chosen in Location's Address.";
                status_doc = "Error";
                logError(status_doc, mensajeError);
                return exito;
              }
              if (UFDEST == '' || UFDEST == null) {
                mensajeError = "The field 'LATAM - PROVINCE' was not chosen in Customer's Address.";
                status_doc = "Error";
                logError(status_doc, mensajeError);
                return exito;
              }

              if (doc_type == 'itemfulfillment' && TransacOther_type == "TrnfrOrd") {
                recOther = RECORD.load({
                  type: record.Type.INTER_COMPANY_TRANSFER_ORDER,
                  id: TransacOther,
                  isDynamic: false
                });
                getCustomerFields(recOther.getValue('tosubsidiary'));

              } else {
                getCustomerFields(customer_id);
              }
              if (PERFILDEST == '' || PERFILDEST == null) {
                mensajeError = "The field 'LATAM BR - TAX CALC. RECEIVER PROFILE' in Customer's form is empty.";
                status_doc = "Error";
                logError(status_doc, mensajeError);
                return exito;
              }

              getSubsidiaryFields(subsiTransac);
              if (PERFILREM == '' || PERFILREM == null) {
                mensajeError = "The field 'LATAM BR - TAX CALC. SENDER PROFILE' in Subsidiary's form is empty.";
                status_doc = "Error";
                logError(status_doc, mensajeError);
                return exito;
              }

              getTransactionFields();
              if (NATOP == '' || NATOP == null) {
                mensajeError = "The field 'LATAM - BR TAX CALC NATURE OF OPERATION' in 'LatamReady - BR Transaction Fields' is empty.";
                status_doc = "Error";
                logError(status_doc, mensajeError);
                return exito;
              }
              logicFlag = getSetupTaxSubsidiary();
              LOG.error("logicFlag", logicFlag);
              if (logicFlag != null) {

                if (logicFlag != 0) {

                  //Web Service Calcular
                  var returnCalcular = WSCalcular(arr_item);
                  //LOG.error("returnCalcular", returnCalcular);

                  //Si se obtuvo error 8 - regla no encontrada, "exito" continuara en false
                  ValidarStatusDeRetorno(arr_item, returnCalcular);
                  //Enviar la respuesta del WS Calcular
                  //sendMail(xmlEnvio, returnCalcular);

                  if (!exito) { //exito == false
                    library_taxtrans.deleteTaxResults(rec);
                    library_taxtrans.deleteTaxLines(rec);
                    if (RUNTIME.executionContext != 'MAPREDUCE') {
                      rec.save({
                        disableTriggers: true
                      });
                    }
                    // rec.save({
                    //     disableTriggers: true
                    // });

                    // if (is_autofact == 'true') {
                    //     REDIRECT.toRecord({
                    //         type: RECORD.Type.INVOICE,
                    //         id: internalId
                    //     });
                    //     LOG.error("redirect.toRecord", exito);
                    // }

                    return exito;
                  }

                  //Setear calculos en los items
                  SetearValoresPorItem(arr_item, returnCalcular);

                  // if (exito && is_autofact == 'true') {
                  //
                  //     var url_stlt_ser = URL.resolveScript({
                  //         scriptId: 'customscript_lmry_br_ei_own_gene_stlt',
                  //         deploymentId: 'customdeploy_lmry_br_ei_own_gene_stlt',
                  //         returnExternalUrl: true
                  //     });
                  //
                  //     LOG.error('url_stlr', url_stlt_ser);
                  //     url_stlt_ser += '&doc_id=' + doc_id + '&doc_type=' + doc_type + '&id_con=' + id_con + '&is_autofact=' + is_autofact;
                  //     //url_stlt_ser += '&doc_id=' + doc_id + '&doc_type=' + doc_type + '&id_con=' + id_con;
                  //     LOG.error('url_stlr', url_stlt_ser);
                  //
                  //     var objResponse = HTTPS.get(url_stlt_ser);
                  //     LOG.error('response url_stlr', objResponse.body);
                  //
                  // }

                } else {
                  logError("Error", '"LatamReady A/R - Calculation Form" selection is necessary');
                }

              } else {
                logError("Error", "LatamReady - Setup Tax Subsidiary configuration is necessary");
              }

            } else {
              logError("Error", "No inventory items found");
            }
          }
        }

        LOG.error("Success?", exito);
        //   LOG.error('UNitsUse', scriptObj.getRemainingUsage());
        LOG.error("FIN", "FIN");

      } catch (e) {
        LOG.error("e", e.valueOf().toString());

        var logRecord = RECORD.create({
          type: 'customrecord_lmry_taxc_log'
        });
        logRecord.setValue('custrecord_lmry_taxc_log_doc', internalId);
        logRecord.setValue('custrecord_lmry_taxc_log_subsidiary', subsiTransac);
        logRecord.setValue('custrecord_lmry_taxc_log_employee', currentUser);
        logRecord.setValue('custrecord_lmry_taxc_log_status', "Error");
        logRecord.setValue('custrecord_lmry_taxc_log_response', e.valueOf().toString().substring(0, 300));
        logRecord.setValue('custrecord_lmry_taxc_log_doc_code', '');
        logRecord.save();

      }

      return exito;
    }

    function getAddressFields(location_id) {

      //ABB STATE de salida de la mercancia
      var busqAddressOrig = SEARCH.lookupFields({
        type: 'location',
        id: location_id,
        columns: 'address.custrecord_lmry_addr_prov_acronym'
      });

      UFORIG = busqAddressOrig["address.custrecord_lmry_addr_prov_acronym"];

      if (doc_type == 'estimate' || doc_type == 'vendorbill' || doc_type == 'purchaseorder' || doc_type == 'vendorcredit' || (doc_type == 'itemfulfillment' && TransacOther_type == 'VendAuth')) {
        var aux_addressid = internalId;
        if (doc_type == 'itemfulfillment' && TransacOther_type == 'VendAuth') {
          aux_addressid = TransacOther;
        }
        //ABB STATE de destino de la mercancia
        var busqAddressBill = SEARCH.create({
          type: "transaction",
          filters: [
            ["mainline", "is", "T"],
            "AND",
            ["internalid", "anyof", aux_addressid]
          ],
          columns: [
            SEARCH.createColumn({
              name: "custrecord_lmry_addr_prov_acronym",
              join: "billingAddress"
            })
          ]
        });

        resultAddressBill = busqAddressBill.run().getRange(0, 10);

        if (resultAddressBill != null && resultAddressBill.length != 0) {
          row = resultAddressBill[0].columns;
          UFDEST = resultAddressBill[0].getValue(row[0]);
        }
      } else if (doc_type == 'itemreceipt') {

        var aux_location = rec.getSublistValue({
          sublistId: 'item',
          fieldId: 'location',
          line: 0
        });
        var busqAddressBill = SEARCH.lookupFields({
          type: 'location',
          id: aux_location,
          columns: 'address.custrecord_lmry_addr_prov_acronym'
        });

        UFDEST = busqAddressBill["address.custrecord_lmry_addr_prov_acronym"];
      } else {

        //ABB STATE de destino de la mercancia
        var busqAddressShip = SEARCH.create({
          type: "transaction",
          filters: [
            ["mainline", "is", "T"],
            "AND",
            ["internalid", "anyof", internalId]
          ],
          columns: [
            SEARCH.createColumn({
              name: "custrecord_lmry_addr_prov_acronym",
              join: "shippingAddress"
            })
          ]
        });

        resultAddressShip = busqAddressShip.run().getRange(0, 10);

        if (resultAddressShip != null && resultAddressShip.length != 0) {
          row = resultAddressShip[0].columns;
          UFDEST = resultAddressShip[0].getValue(row[0]);
        }
      }
    }

    function getSubsidiaryFields(filter_subsi) {

      var busqSubsiProfile = SEARCH.create({
        type: 'subsidiary',
        columns: 'custrecord_lmry_taxc_send_prof.custrecord_lmry_taxc_send_prof_code',
        filters: ['internalid', 'anyof', filter_subsi]
      });

      var resultSubsiProfile = busqSubsiProfile.run().getRange(0, 20);

      if (resultSubsiProfile != null && resultSubsiProfile.length != 0) {
        for (var i = 0; i < resultSubsiProfile.length; i++) {
          var row = resultSubsiProfile[i].columns;
          PERFILREM[i] = resultSubsiProfile[i].getValue(row[0]);
        }
        PERFILREM.sort(function(a, b) {
          return a - b
        });
      }

      //LOG.error("PERFILREM", PERFILREM);
    }

    function getCustomerFields(filter_customer) {
      var type_entity = '';
      var columnCustomer = '';

      if (doc_type == 'itemfulfillment' && TransacOther_type == 'TrnfrOrd') {
        type_entity = 'subsidiary';
        columnCustomer = ['custrecord_lmry_taxc_recv_prof.custrecord_lmry_taxc_recv_prof_code']
      } else {
        if (doc_type == 'vendorbill' || doc_type == 'purchaseorder' || doc_type == 'vendorcredit' || (doc_type == 'itemfulfillment' && TransacOther_type == 'VendAuth')) {
          type_entity = 'vendor';
        } else {
          type_entity = 'customer';
        }
        columnCustomer = ['custentity_lmry_taxc_recv_prof.custrecord_lmry_taxc_recv_prof_code']
      }

      var busqCustProfCode = SEARCH.create({
        type: type_entity,
        columns: columnCustomer,
        filters: ['internalid', 'anyof', filter_customer]
      });

      var resultCustProfCode = busqCustProfCode.run().getRange(0, 20);

      if (resultCustProfCode != null && resultCustProfCode.length != 0) {
        for (var i = 0; i < resultCustProfCode.length; i++) {
          var row = resultCustProfCode[i].columns;
          PERFILDEST[i] = resultCustProfCode[i].getValue(row[0]);
        }
        PERFILDEST.sort(function(a, b) {
          return a - b
        });
      }

      //LOG.error("PERFILDEST", PERFILDEST);
    }

    function getTransactionFields() {

      /* Registro Personalizado LatamReady - BR Transaction */

      var busqBRTxFields = SEARCH.create({
        type: 'customrecord_lmry_br_transaction_fields',
        columns: 'custrecord_lmry_br_taxc_nat_op.custrecord_lmry_taxc_nat_op_code',
        filters: ['custrecord_lmry_br_related_transaction', 'anyof', internalId]

      });
      resultBRTxFields = busqBRTxFields.run().getRange(0, 10);

      if (resultBRTxFields != null && resultBRTxFields.length != 0) {
        row = resultBRTxFields[0].columns;
        NATOP = resultBRTxFields[0].getValue(row[0]);
      }
    }

    function getSetupTaxSubsidiary() {

      /* Registro Personalizado Latam - Setup Tax Subsidiary */
      var checkValue = null;
      var busqSetupTaxCheck = SEARCH.create({
        type: 'customrecord_lmry_setup_tax_subsidiary',
        columns: ['custrecord_lmry_setuptax_br_taxfromgross'],
        filters: [
          ['custrecord_lmry_setuptax_subsidiary', 'anyof', subsiTransac], 'and', ['isinactive', 'is', 'F']
        ]

      });
      var resultSetupTaxCheck = busqSetupTaxCheck.run().getRange(0, 10);

      if (resultSetupTaxCheck != null && resultSetupTaxCheck.length != 0) {
        var row = resultSetupTaxCheck[0].columns;
        var check = resultSetupTaxCheck[0].getValue(row[0]);
        if (check == '1' || check == '3') { //Logica 0
          checkValue = 2;
        } else if (check == '2') { //Logica 1
          checkValue = 1;
        } else if (check == '4') {
          //Flujo 3
          checkValue = 3;
        } else {
          checkValue = 0;
        }
      }

      return checkValue;
    }

    function SetearValoresPorItem(Array_items, returnCalcular) {

      var j = 1;
      var arr_rsp = [];

      for (var i = 0; i < Array_items.length; i++) {

        /* NF-e */
        var cad_NFe = returnCalcular.split('a:Item>')[j];

        if (cad_NFe != null && cad_NFe != '') {
          cad_NFe = cad_NFe.substring(0, cad_NFe.length - 2);
          /* NCM */
          var cadNCM = cad_NFe.split('a:NCM>')[1];
          cadNCM = cadNCM.substring(0, cadNCM.length - 2);

          /* CFOP */
          var cadCFOP = '';
          if (tpNF == 1 || (tpNF == 4 && doc_type == 'creditmemo')) {
            cadCFOP = cad_NFe.split('a:CFOP>')[1];
            if (cadCFOP != null && cadCFOP != '') {
              cadCFOP = cadCFOP.substring(0, cadCFOP.length - 2);
            }
          } else if (tpNF == 0 || (tpNF == 4 && doc_type == 'vendorcredit')) {
            cadCFOP = cad_NFe.split('CFOP_ENTRADA=')[1];
            if (cadCFOP != null && cadCFOP != '') {
              cadCFOP = cadCFOP.substring(0, 4);
            }
          }

          // Valido si en la transaccion no existen ya seteados los valores de NCM y CFOP
          if (Array_items[i][6] == cadNCM && Array_items[i][7] == cadCFOP) {
            //LOG.error("CFOP y MCN seteados correctamente", cadNCM + ' - ' + cadCFOP);
          } else {
            var NCM_id = '';
            //LOG.error("Revisaremos si falta setear al MCN, CFOP o ambos", cadNCM + ' - ' + cadCFOP);
            //LOG.error("Primero, revisaremos si falta setear al MCN");
            if (Array_items[i][6] != cadNCM) {
              //LOG.error("MCN no es el retornado por Systax", cadNCM + " - " + Array_items[i][6]);
              var busqNCM = SEARCH.create({
                type: 'customrecord_lmry_br_ncm_codes',
                columns: ['internalid'],
                filters: [
                  ["formulatext: REPLACE({name}, '.', '')", "contains", cadNCM]
                ]
              });

              var resultNCM = busqNCM.run().getRange(0, 10);
              //LOG.error("Revisaremos si existe el MCN");
              if (resultNCM != null && resultNCM.length != 0) {
                //LOG.error("MCN existe como data");
                var row = resultNCM[0].columns;
                NCM_id = resultNCM[0].getValue(row[0]);
              } else {
                //LOG.error("MCN no existe, debe crearse");
                var recNCM = RECORD.create({
                  type: 'customrecord_lmry_br_ncm_codes'
                });
                recNCM.setValue('name', cadNCM);
                NCM_id = recNCM.save();
              }
            } else {
              //LOG.error("MCN coincide con el retornado por Systax");
              NCM_id = Array_items[i][8];
            }
            //LOG.error("Segundo, revisaremos si falta setear al CFOP");
            if (Array_items[i][7] != cadCFOP) {
              //LOG.error("CFOP no es el retornado por Systax", cadCFOP + " - " + Array_items[i][7]);
              var busqCFOP = SEARCH.create({
                type: 'customrecord_lmry_br_cfop_codes',
                columns: ['internalid', 'custrecord_lmry_br_cfop_description'],
                filters: [
                  ["formulatext: REPLACE({name}, '.', '')", "contains", cadCFOP], 'and', ["formulatext: REPLACE({custrecord_lmry_br_cfop_ncm_code.name}, '.', '')", "contains", cadNCM], 'and', ["custrecord_lmry_br_cfop_transaction", "anyof", txn_type]
                ]
              });

              var CFOP_id = '';
              var descCFOP = '';
              var resultCFOP = busqCFOP.run().getRange(0, 10);
              //LOG.error("Revisaremos si existe el CFOP con el MCN asignado y el Tipo de txn");
              if (resultCFOP != null && resultCFOP.length != 0) {
                //LOG.error("CFOP existe como data y esta correctamente configurado");
                var row = resultCFOP[0].columns;
                CFOP_id = resultCFOP[0].getValue(row[0]);
                descCFOP = resultCFOP[0].getValue(row[1]);
              } else {
                //LOG.error("CFOP no esta configurado o no existe");
                var _busqCFOP = SEARCH.create({
                  type: 'customrecord_lmry_br_cfop_codes',
                  columns: ['internalid', 'custrecord_lmry_br_cfop_ncm_code', 'custrecord_lmry_br_cfop_transaction'],
                  filters: [
                    ["formulatext: REPLACE({name}, '.', '')", "contains", cadCFOP]
                  ]
                });

                var _resultCFOP = _busqCFOP.run().getRange(0, 10);
                if (_resultCFOP != null && _resultCFOP.length != 0) {
                  //LOG.error("CFOP existe, solo falta configurar");
                  var row = _resultCFOP[0].columns;
                  CFOP_id = _resultCFOP[0].getValue(row[0]);
                  var cad_ncms = _resultCFOP[0].getValue(row[1]);
                  var arr_NCM = [];
                  arr_NCM = cad_ncms.split(',');
                  //LOG.error("Se asigna MCN a CFOP si es que hace falta");
                  if (arr_NCM != '' && arr_NCM != null) {
                    var k = 0;
                    for (k = 0; k < arr_NCM.length; k++) {
                      if (arr_NCM[k] == NCM_id) {
                        break;
                      }
                    }
                    if (k == arr_NCM.length) {
                      arr_NCM[arr_NCM.length] = NCM_id;
                    }
                  } else {
                    arr_NCM[0] = NCM_id;
                  }

                  var trans_type = _resultCFOP[0].getValue(row[2]);
                  var arr_txntype = [];
                  arr_txntype = trans_type.split(',');
                  //LOG.error("Se asigna Tipo de txn a CFOP si es que hace falta");
                  if (arr_txntype != '' && arr_txntype != null) {
                    var k = 0;
                    for (var k = 0; k < arr_txntype.length; k++) {
                      if (arr_txntype[k] == txn_type) {
                        break;
                      }
                    }
                    if (k == arr_txntype.length) {
                      arr_txntype[arr_txntype.length] = txn_type;
                    }
                  } else {
                    arr_txntype[0] = txn_type;
                  }

                  //LOG.error("Guardamos la configuracion del CFOP");
                  var cfop_record = RECORD.load({
                    type: 'customrecord_lmry_br_cfop_codes',
                    id: CFOP_id,
                    isDynamic: false
                  });
                  cfop_record.setValue('custrecord_lmry_br_cfop_ncm_code', arr_NCM);
                  cfop_record.setValue('custrecord_lmry_br_cfop_transaction', arr_txntype);
                  var cfop_type = cfop_record.getValue('custrecord_lmry_br_cfop_type');
                  if (cfop_record.getValue('custrecord_lmry_br_cfop_description') != '' && cfop_record.getValue('custrecord_lmry_br_cfop_description') != null) {
                    descCFOP = cfop_record.getValue('custrecord_lmry_br_cfop_description');
                  } else {
                    descCFOP = cadCFOP;
                    cfop_record.setValue('custrecord_lmry_br_cfop_description', cadCFOP);
                  }

                  if (cfop_type == null || cfop_type == '') {
                    var outgoing = cadCFOP.toString().charAt(0);
                    if (['5', '6', '7'].indexOf(outgoing) != -1) {
                      cfop_record.setValue('custrecord_lmry_br_cfop_type', 2);
                    } else if (['1', '2', '3'].indexOf(outgoing) != -1) {
                      cfop_record.setValue('custrecord_lmry_br_cfop_type', 1);
                    }
                  }
                  cfop_record.save();
                } else {
                  //LOG.error("CFOP no existe, debe crearse y configurarse");
                  var recCFOP = RECORD.create({
                    type: 'customrecord_lmry_br_cfop_codes'
                  });
                  recCFOP.setValue('name', cadCFOP);
                  descCFOP = cadCFOP;
                  recCFOP.setValue('custrecord_lmry_br_cfop_ncm_code', NCM_id);
                  recCFOP.setValue('custrecord_lmry_br_cfop_transaction', txn_type);
                  recCFOP.setValue('custrecord_lmry_br_cfop_description', cadCFOP);

                  var outgoing = cadCFOP.toString().charAt(0);
                  if (['5', '6', '7'].indexOf(outgoing) != -1) {
                    recCFOP.setValue('custrecord_lmry_br_cfop_type', 2);
                  } else if (['1', '2', '3'].indexOf(outgoing) != -1) {
                    recCFOP.setValue('custrecord_lmry_br_cfop_type', 1);
                  }
                  CFOP_id = recCFOP.save();
                }
              }
              //LOG.error("CFOP_id + cadCFOP + Array_items[i][4]", CFOP_id + ' - ' + cadCFOP + ' - ' + Array_items[i][4]);
            } else {
              CFOP_id = Array_items[i][13];
            }

            rec.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_tran_mcn',
              line: Array_items[i][4],
              value: NCM_id
            });

            rec.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_tran_outgoing_cfop_di',
              line: Array_items[i][4],
              value: descCFOP
            });

            rec.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_tran_outgoing_cfop',
              line: Array_items[i][4],
              value: CFOP_id
            });

          }

          arr_rsp[i] = {
            position: Array_items[i][4],
            item: Array_items[i][0],
            xml: cad_NFe
          };
        }

        LOG.error("TaxResponse", cad_NFe);

        j += 2;
      }

      library_taxtrans.SendTaxCalcRsp(rec, arr_rsp);
      logError("Success", "");
      if (RUNTIME.executionContext != 'MAPREDUCE') {
        rec.save({
          disableTriggers: true
        });
      }
      // rec.save({
      //     disableTriggers: true
      // });
    }

    function ValidarStatusDeRetorno(Array_items, returnCalcular) {
      var j = 1;
      for (var i = 0; i < Array_items.length; i++) {

        //Se ha validado que las siguientes etiquetas sean retornadas en todos los responses
        var cod_status = returnCalcular.split('a:cod>')[j];
        cod_status = cod_status.substring(0, cod_status.length - 2);

        var msg_status = returnCalcular.split('a:msg>')[j];
        msg_status = msg_status.substring(0, msg_status.length - 2);

        // var cad_generico = returnCalcular.split('a:generico>')[j];
        // cad_generico = cad_generico.substring(0, cad_generico.length - 2);

        // if (cod_status != '0' && cad_generico.indexOf('ondemand') > -1) {
        if (cod_status != '0') {
          mensajeError = cod_status + ' - ' + msg_status;
          logError("Error", mensajeError);
          return true;
        }

        j += 2;
      }

      exito = true;
    }

    function getEnableFeatures() {

      /* Registro Personalizado LatamReady - Tax Calculator Enable Feature */
      var busqEnabFet = SEARCH.create({
        type: 'customrecord_lmry_taxc_enab_feat',
        columns: ['custrecord_lmry_taxc_ef_sessionid', 'custrecord_lmry_taxc_ef_orig_sys', 'custrecord_lmry_taxc_ei_url_ws',
          'custrecord_lmry_item_type', 'custrecord_lmry_taxc_ei_trans_type', 'custrecord_lmry_taxc_ei_user',
          'custrecord_lmry_taxc_ei_password', 'custrecord_lmry_base_type', 'custrecord_lmry_taxc_ei_bank_key'
        ],
        filters: [
          ['custrecord_lmry_taxc_ef_subsidiary', 'anyof', subsiTransac]
        ]
      });
      var resultEnabFet = busqEnabFet.run().getRange(0, 10);

      if (resultEnabFet != null && resultEnabFet.length != 0) {
        row = resultEnabFet[0].columns;
        SESSIONID = resultEnabFet[0].getValue(row[0]);
        SISORIG = resultEnabFet[0].getValue(row[1]);
        if (SESSIONID == null || SESSIONID == '' || SISORIG == null || SISORIG == '') {
          logError('Error', "The 'LATAM - TAX CALCULATOR SESSION ID' and 'LATAM - TAX CALCULATOR ORIGIN SYSTEM' fields from the 'Tax Calculator - Enable Features' configuration are mandatory.");
          return false;
        }
        URL_WS = resultEnabFet[0].getValue(row[2]);
        if (URL_WS == null || URL_WS == '') {
          logError('Error', "The 'LATAM - TAX CALCULATOR URL WS' field from the 'Tax Calculator - Enable Features' configuration is mandatory.");
          return false;
        }
        CHECK_ITEM_TYPE = resultEnabFet[0].getValue(row[3]);
        USER = resultEnabFet[0].getValue(row[5]);
        PASSWORD = resultEnabFet[0].getValue(row[6]);
        if ((USER == null || USER == '' || PASSWORD == null || PASSWORD == '') && prodEnviron) {
          logError('Error', "The 'LATAM - TAX CALCULATOR USER' and 'LATAM - TAX CALCULATOR PASSWORD' fields from the 'Tax Calculator - Enable Features' configuration are mandatory.");
          return false;
        }
        CHAVE_BANCO = resultEnabFet[0].getValue(row[8]);
        var auxNcm = resultEnabFet[0].getValue(row[7]);
        if (auxNcm == 'T' || auxNcm == true) {
          check_baseNCM = true;
        } else {
          if (CHAVE_BANCO == '' && prodEnviron) {
            logError('Error', "The field 'LATAM - TAX CALCULATOR BASE KEY' needs to be completed when the 'LATAM - COMMON BASE BY NCM' checkbox is not marked");
            return false;
          }
        }

        if (resultEnabFet[0].getValue(row[4]) != '' && resultEnabFet[0].getValue(row[4]) != null) {
          var arr_txtype = [];
          arr_txtype = JSON.parse(resultEnabFet[0].getValue(row[4]));
          for (var i = 0; i < arr_txtype.length; i++) {
            var tx_type = arr_txtype[i];
            //LOG.error("tx_type + doc_type", tx_type + ' - ' + doc_type);
            if (tx_type == doc_type) {
              return true;
            }
          }
        }
        logError('Error', "This type of transaction was not selected in the 'LATAM - BR TRANSACTION TYPE' field from the 'Tax Calculator - Enable Features' configuration.");
        return false;
      } else {
        logError('Error', "The configuration in 'Tax Calculator - Enable Features' is needed.");
        return false;
      }
    }

    function logError(status_doc, resp) {

      var logRecord = RECORD.create({
        type: 'customrecord_lmry_taxc_log'
      });
      logRecord.setValue('custrecord_lmry_taxc_log_doc', internalId);
      logRecord.setValue('custrecord_lmry_taxc_log_subsidiary', subsiTransac);
      logRecord.setValue('custrecord_lmry_taxc_log_employee', currentUser);
      logRecord.setValue('custrecord_lmry_taxc_log_status', status_doc);
      logRecord.setValue('custrecord_lmry_taxc_log_response', resp.substring(0, 300));
      logRecord.setValue('custrecord_lmry_taxc_log_doc_code', nameTypeDoc);
      logRecord.setValue('custrecord_lmry_taxc_log_request', xmlEnvio);
      logRecord.save();
    }

    function ObtenerCamposPorItem() {
      var numLines, iter = 0;
      // Nos aseguramos limpiando el array de items
      arr_item = [];

      //Obtiene numero de items por invoice
      numLines = rec.getLineCount({
        sublistId: 'item'
      });

      LOG.error("Total items lines", numLines);

      for (var i = 0; i < numLines; i++) {
        var arr = new Array();
        var auxFlag = false;

        var item_type = rec.getSublistValue({
          sublistId: 'item',
          fieldId: 'itemtype',
          line: i
        });

        if (CHECK_ITEM_TYPE == true || CHECK_ITEM_TYPE == 'T') { //boolean validation || string validation

          var aux_item_type = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_invoice_item_type',
            line: i
          });

          if (item_type != 'OthCharge' && item_type != 'Discount') {
            if (aux_item_type != '09' && aux_item_type != '') {
              auxFlag = true;
            } else {
              logError('Error', "The field 'LATAM COL - BR ITEM TYPE CODE' is empty or not configured in the current transaction form. If it's empty, you can configure it's content in the 'LATAM - BR ITEM TYPE' field from the Item form.");
              return false;
            }
          }
        } else {
          if (item_type == 'InvtPart') {
            auxFlag = true;
          }
        }

        if (auxFlag) {
          flag = true;
          arr[0] = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: i
          });

          arr[1] = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: i
          });

          if (doc_type == 'itemfulfillment' || doc_type == 'itemreceipt') {

            arr[2] = rec.getSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_prec_unit_so',
              line: i
            });

            if (arr[2] == '' || arr[2] == null || arr[2] === undefined) {
              mensajeError = "The field 'LATAM COL - PRECIO UNITARIO SO' is empty or not configured in the current transaction form.";
              status_doc = "Error";
              logError(status_doc, mensajeError);
              return false;
            }

          } else {

            arr[2] = rec.getSublistValue({
              sublistId: 'item',
              fieldId: 'grossamt',
              line: i
            });
          }

          arr[3] = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_origin_code',
            line: i
          }) + '';

          if (arr[3] == '' || arr[3] == 'undefined') {
            mensajeError = "The field 'LATAM COL - BR ORIGIN CODE' is empty or not configured in the current transaction form. If it's empty, you can configure it's content in the 'LATAM - BR ORIGIN OF MERCHANDISE' field from the Item form.";
            status_doc = "Error";
            logError(status_doc, mensajeError);
            return false;
          }

          arr[4] = i;

          var busqItemName = SEARCH.lookupFields({
            type: 'item',
            id: arr[0],
            columns: 'itemid'
          });

          arr[5] = busqItemName["itemid"];

          var ncm_value = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_tran_mcn',
            line: i
          });

          var aux_ncm_id = '';
          if (ncm_value != '' && ncm_value != null) {
            var ncm_search = SEARCH.lookupFields({
              type: 'customrecord_lmry_br_ncm_codes',
              id: ncm_value,
              columns: ['name']
            });

            aux_ncm_id = ncm_value;
            ncm_value = ncm_search.name;
            ncm_value = ncm_value.replace(/\./g, '');
          } else {
            ncm_value = '';
          }

          arr[6] = ncm_value;

          var cfop_value = rec.getSublistText({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_tran_outgoing_cfop',
            line: i
          });

          if (cfop_value != '' && cfop_value != null) {
            cfop_value = cfop_value.replace(/\./g, '');
          } else {
            cfop_value = '';
          }

          arr[7] = cfop_value;

          arr[8] = aux_ncm_id;

          arr[9] = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_total_impuestos',
            line: i
          });

          arr[10] = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_freight_val',
            line: i
          });

          if (arr[10] === undefined) {
            arr[10] = '';
          }

          arr[11] = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_insurance_val',
            line: i
          });

          if (arr[11] === undefined) {
            arr[11] = '';
          }

          arr[12] = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_br_expens_val',
            line: i
          });

          if (arr[12] === undefined) {
            arr[12] = '';
          }

          if (cfop_value != '') {
            arr[13] = rec.getSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_tran_outgoing_cfop',
              line: i
            });
          } else {
            arr[13] = '';
          }

          arr[14] = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_col_sales_discount',
            line: i
          });

          if (arr[14] === undefined) {
            arr[14] = '';
          }

          if (tpNF == 0) {
            arr[15] = rec.getSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_purp_code',
              line: i
            }) + '';

            if (arr[15] == '' || arr[15] === undefined) {
              mensajeError = "The field 'LATAM COL - BR PURPOSE CODE' is empty or not configured in the current transaction form. If it's empty, you can configure it's content in the 'LATAM - BR PURPOSE OF MERCHANDISE' field from the Item form.";
              status_doc = "Error";
              logError(status_doc, mensajeError);
              return false;
            }
          }

          arr_item[iter] = arr;
          iter++;
        }
      }

      LOG.error("Total items inventariables - arr_item", iter + " - " + arr_item);

      return true;
    }

    function WSCalcular(Array_items) {

      xmlEnvio =
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:tax="http://schemas.datacontract.org/2004/07/TaxEngine.chamada">\n' +
        '<soapenv:Header/>\n' +
        '<soapenv:Body>\n' +
        '<tem:Calcular>\n' +
        '<tem:chamada>\n' +
        '<tax:cabecalho>\n' +
        '<tax:usuario>' + USER + '</tax:usuario>\n' +
        '<tax:senha>' + PASSWORD + '</tax:senha>\n' +
        '<tax:sessionID>' + SESSIONID + '</tax:sessionID>\n' +
        '<tax:sisOrig>' + SISORIG + '</tax:sisOrig>\n' +
        '<tax:dtCalc>' + DTCALC + '</tax:dtCalc>\n' +
        '<tax:ufOrig>' + UFORIG + '</tax:ufOrig>\n' +
        '<tax:ufDest>' + UFDEST + '</tax:ufDest>\n' +
        '<tax:tpNF>' + tpNF + '</tax:tpNF>\n' +
        '<tax:munOrig></tax:munOrig>\n' +
        '<tax:munDest></tax:munDest>\n';
      if (logicFlag == 2) {
        xmlEnvio += '<tax:impAtiv>0</tax:impAtiv>\n';
      }
      if (!check_baseNCM) {
        xmlEnvio += '<tax:chaveBanco>' + CHAVE_BANCO + '</tax:chaveBanco>\n';
      }

      xmlEnvio +=
        '</tax:cabecalho>\n' +
        '<tax:itens>\n';

      for (var k = 0; k < Array_items.length; k++) {

        var vProdU = Number(Array_items[k][2]);
        if (doc_type == 'itemfulfillment') {
          vProdU = Number(Array_items[k][2] * Array_items[k][1]);
        }

        if (logicFlag == 2 || logicFlag == 3) {
          vProdU = Number(Array_items[k][2]) - Number(Array_items[k][9]);
        }
        vProdU = Number(vProdU) / Number(Array_items[k][1]);

        xmlEnvio +=
          '<tax:Item>\n' +
          '<tax:id>' + k + '</tax:id>\n' +
          '<tax:natOp>' + NATOP + '</tax:natOp>\n';
        if (tpNF == 0) {
          xmlEnvio += '<tax:finalidade>' + Array_items[k][15] + '</tax:finalidade>\n';
        }
        xmlEnvio +=
          '<tax:perfilRem>' + PERFILREM + '</tax:perfilRem>\n' +
          '<tax:perfilDest>' + PERFILDEST + '</tax:perfilDest>\n';
        if (!check_baseNCM) {
          xmlEnvio += '<tax:cProd>' + Array_items[k][5] + '</tax:cProd>\n';
        }
        xmlEnvio += '<tax:orig>' + Array_items[k][3] + '</tax:orig>\n';
        if (check_baseNCM) {
          xmlEnvio += '<tax:NCM>' + Array_items[k][6] + '</tax:NCM>\n';
        }
        xmlEnvio +=
          '<tax:vProdUni>' + vProdU + '</tax:vProdUni>\n' +
          '<tax:qTrib>' + Array_items[k][1] + '</tax:qTrib>\n' +
          '<tax:vFrete>' + Array_items[k][10] + '</tax:vFrete>\n' +
          '<tax:vSeg>' + Array_items[k][11] + '</tax:vSeg>\n' +
          '<tax:vOutro>' + Array_items[k][12] + '</tax:vOutro>\n' +
          '<tax:vDesc>' + Array_items[k][14] + '</tax:vDesc>\n' +
          '</tax:Item>\n';
      }

      LOG.error("Number of inventory items: ", Array_items.length);

      xmlEnvio +=
        '</tax:itens>\n' +
        '</tem:chamada>\n' +
        '</tem:Calcular>\n' +
        '</soapenv:Body>\n' +
        '</soapenv:Envelope>';

      // var soapHeaders = new Array();
      // soapHeaders['Content-Type'] = 'text/xml; charset=utf-8';
      // soapHeaders['SOAPAction'] = "http://tempuri.org/IService1/Calcular";

      var soapHeaders = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IService1/Calcular'
      };
      var objCalcular = '';
      objCalcular =
        HTTP.post({
          url: URL_WS,
          body: xmlEnvio,
          headers: soapHeaders
        });

      var returnCalcular = objCalcular.body;
      returnCalcular = replaceXML(returnCalcular);

      return returnCalcular;
    }

    function sendMail(content, WSCalcular) {

      var recEmp = SEARCH.lookupFields({
        type: SEARCH.Type.EMPLOYEE,
        id: currentUser,
        columns: ['firstname', 'email']
      });
      var nameUser = recEmp.firstname;
      var emailUser = recEmp.email;
      var body = '<body text="#333333" link="#014684" vlink="#014684" alink="#014684">';
      body += '<table width="642" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td width="100%" valign="top">';
      body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td width="100%" colspan="2"><img style="display: block;" src="https://system.na1.netsuite.com/core/media/media.nl?id=921&c=TSTDRV1038915&h=c493217843d184e7f054" width="645" alt="main banner"/></td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td bgcolor="#d50303" width="15%">&nbsp;</td>';
      body += '<td bgcolor="#d50303" width="85%">';
      body += '<font style="color:#FFFFFF; line-height:130%; font-family:Arial, Helvetica, sans-serif; font-size:19px">';
      body += 'Estimado(a) ' + nameUser + ':<br>';
      body += '</font>';
      body += '</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="100%" bgcolor="#d50303" colspan="2" align="right"><a href="http://www.latamready.com/#contac"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=923&c=TSTDRV1038915&h=3c7406d759735a1e791d" width="94" style="margin-right:45px" /></a></td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="100%" bgcolor="#FFF" colspan="2" align="right">';
      body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=924&c=TSTDRV1038915&h=c135e74bcb8d5e1ac356" width="15" style="margin:5px 1px 5px 0px" /></a>';
      body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=919&c=TSTDRV1038915&h=9c937774d04fb76747f7" width="15" style="margin:5px 1px 5px 0px" /></a>';
      body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=928&c=TSTDRV1038915&h=fc69b39a8e7210c65984" width="15" style="margin:5px 47px 5px 0px" /></a>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%">';
      body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:13px">';
      if (exito) {
        body += '<p>Este es un mensaje automático de LatamReady SuiteApp.</p>';
        body += '<p>Se ha generado la ' + nameTypeDoc + ' <b>' + tranID + '</b> con Internal ID <b>' + internalId + '</b>.</p>';
      } else {
        body += '<p>Este es un mensaje de error automático de LatamReady SuiteApp.</p>';
        body += '<p>Se produjo un error al emitir la ' + nameTypeDoc + ' <b>' + tranID + '</b> con Internal ID <b>' + internalId + '</b> y estado <b>' + status_doc + '</b>. El error es el siguiente:</p>';
        body += '<p>' + mensajeError + '</p>';
        body += '<p>Por favor, comunícate con nuestro departamento de Servicio al Cliente a: customer.care@latamready.com</p>';
        body += '<p>Nosotros nos encargamos.</p>';
      }
      body += '<p>Saludos,</p>';
      body += '<p>El Equipo de LatamReady</p>';
      body += '</font>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<br>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2" bgcolor="#e5e6e7">';
      body += '<tr>';
      body += '<td>&nbsp;</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:12px;" >';
      body += '<i>Este es un mensaje automático. Por favor, no responda este correo electrónico.</i>';
      body += '</font>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td>&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<a href="http://www.latamready.com/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=926&c=TSTDRV1038915&h=e14f0c301f279780eb38" width="169" style="margin:15px 0px 15px 0px" /></a>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=925&c=TSTDRV1038915&h=41ec53b63dba135488be" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=920&c=TSTDRV1038915&h=7fb4d03fff9283e55318" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=929&c=TSTDRV1038915&h=300c376863035d25c42a" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0">';
      body += '<tr>';
      body += '<td>';
      body += '<img src="https://system.na1.netsuite.com/core/media/media.nl?id=918&c=TSTDRV1038915&h=7f0198f888bdbb495497" width="642" style="margin:15px 0px 15px 0px" /></a>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '</body>';

      var fileXML = new Array();

      var i = 0;
      var FileName = 'Archivo EI BR Tax Calculator ' + tranID + '.xml';

      if (content != null && content != '') {
        fileXML[0] = FILE.create({
          name: FileName,
          fileType: FILE.Type.XMLDOC,
          contents: content
        });
        i++;
      }

      if (WSCalcular != null && WSCalcular != '') {
        fileXML[i] = FILE.create({
          name: "Response FuncionCalcular.xml",
          fileType: FILE.Type.XMLDOC,
          contents: WSCalcular
        });
      }

      var subject = '';
      if (exito) {
        subject = "LatamReady - BR EI Tax Calculator " + nameTypeDoc + " " + tranID + ": " + status_doc;
      } else {
        subject = "LatamReady - BR EI Tax Calculator " + nameTypeDoc + " " + tranID + ": Error";
      }

      EMAIL.send({
        author: currentUser,
        recipients: emailUser,
        subject: subject,
        body: body,
        attachments: fileXML
      });

      LOG.error("se envio correo");

    }

    function replaceXML(xml) {
      xml = xml.replace(/&lt;/g, '<');
      xml = xml.replace(/&gt;/g, '>');
      xml = xml.replace(/&amp;lt;/g, '<');
      xml = xml.replace(/&amp;gt;/g, '>');

      return xml;
    }

    function FormatoYYYYMMDD(fecha) {
      var f = FORMAT.parse({
        value: fecha,
        type: FORMAT.Type.DATE
      });
      var d = f.getDate();
      var m = f.getMonth() + 1;
      var y = f.getFullYear();
      m = m + '';
      if (m.length == 1) {
        m = '0' + m;
      }
      d = d + '';
      if (d.length == 1) {
        d = '0' + d;
      }

      var fechaOrden = y + '-' + m + '-' + d;
      //fechaOrden = retornaValorFecha(fechaOrden);
      return fechaOrden;
    }

    return {
      calculateTaxes: calculateTaxes
    };
  });
