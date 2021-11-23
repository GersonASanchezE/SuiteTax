/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ST_AnulacionInvoice_LBRY_V2.0.js  				  ||
||                                                              ||
||  Version   Date         Author        Remarks                ||
||  2.0     14 Nov 2019  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
define(['N/record', 'N/runtime', 'N/log', 'N/search', 'N/format', 'N/transaction', './LMRY_IP_libSendingEmailsLBRY_V2.0'],
  function(record, runtime, log, search, format, transaction, libraryEmail) {

    var LMRY_script = 'LMRY_ST_AnulacionInvoice_LBRY_V2.0.js';

    var MEMO_VOID_WHT = "Voided Latam - WHT"
    var MEMO_WHT = "(LatamTax -  WHT)";

    //Features
    var F_MULTPRICE = false;
    var F_DEPARTMENTS = false;
    var F_LOCATIONS = false;
    var F_CLASSES = false;
    var F_DEPTMANDATORY = false;
    var F_CLASSMANDATORY = false;
    var F_LOCMANDATORY = false;
    var F_REVERSALVOIDING = false;
    var F_APPROVAL_INVOICE = false;
    var F_JOBS = false;

    function anularInvoice(id_invoice) {
      var response = {
        idInvoice: id_invoice,
        wht: false,
        standardvoid: false,
        idcreditmemo: null,
        error: null
      };

      try {

        F_MULTPRICE = runtime.isFeatureInEffect({
          feature: 'MULTPRICE'
        });

        F_DEPARTMENTS = runtime.isFeatureInEffect({
          feature: "DEPARTMENTS"
        });
        F_LOCATIONS = runtime.isFeatureInEffect({
          feature: "LOCATIONS"
        });
        F_CLASSES = runtime.isFeatureInEffect({
          feature: "CLASSES"
        });

        //Obteniendo el estado de los Features Departamento / Clase / Localización
        F_DEPTMANDATORY = runtime.getCurrentScript().getParameter({
          name: 'DEPTMANDATORY'
        });

        F_CLASSMANDATORY = runtime.getCurrentScript().getParameter({
          name: 'CLASSMANDATORY'
        });

        F_LOCMANDATORY = runtime.getCurrentScript().getParameter({
          name: 'LOCMANDATORY'
        });

        F_REVERSALVOIDING = runtime.getCurrentScript().getParameter({
          name: 'REVERSALVOIDING'
        });

        F_APPROVAL_INVOICE = runtime.getCurrentScript().getParameter({
          name: "CUSTOMAPPROVALCUSTINVC"
        });

        F_JOBS = runtime.isFeatureInEffect({
          feature: "JOBS"
        });

        var columns = [
          "internalid", "trandate", "subsidiary", "custbody_lmry_subsidiary_country", "postingperiod", "approvalstatus",
          "accountingperiod.closed", "tranid", "fxamount", "nexus", "taxregoverride", "custbody_ste_transaction_type",
          "subsidiarytaxregnum", "entitytaxregnum"
        ];

        if (F_DEPARTMENTS == true || F_DEPARTMENTS == 'T') {
          columns.push("department");
        }

        if (F_CLASSES == true || F_CLASSES == 'T') {
          columns.push("class");
        }

        if (F_LOCATIONS == true || F_LOCATIONS == 'T') {
          columns.push("location");
        }

        var invoice = search.lookupFields({
          type: "invoice",
          id: id_invoice,
          columns: columns
        });

        log.error('invoice', JSON.stringify(invoice));
        var approvalstatus = '';
        if (invoice.approvalstatus && invoice.approvalstatus.length) {
          approvalstatus = Number(invoice.approvalstatus[0].value);
        }

        var isClosedPeriod = invoice["accountingperiod.closed"];
        response['closedperiod'] = isClosedPeriod;

        if ((!F_APPROVAL_INVOICE || F_APPROVAL_INVOICE == 'F') || ((F_APPROVAL_INVOICE == true || F_APPROVAL_INVOICE == 'T') && approvalstatus == 2)) {

          log.error('[isClosedPeriod, F_REVERSALVOIDING]', [isClosedPeriod, F_REVERSALVOIDING].join(','));

          var taxResults = getTaxResults(id_invoice);
          log.error('taxResults', JSON.stringify(taxResults));

          var whtObject = getWithholdingTax(id_invoice);
          log.error('whtObject', JSON.stringify(whtObject));
          if (whtObject['id']) {
            response['wht'] = true;
          }

          //Si el periodo esta abierto y es posible la anulacion estandar
          if (!isClosedPeriod && (F_REVERSALVOIDING == false || F_REVERSALVOIDING == 'F')) {
            //si tiene retencion se anula primero el credit memo de retencion
            if (whtObject['id']) {
              voidWHTCreditMemo(whtObject['id']);
            }

            transaction.void({
              type: transaction.Type.INVOICE,
              id: id_invoice
            });

            response['standardvoid'] = true;
          } else {

            var idSubsidiary = invoice.subsidiary[0].value;
            //obtener los formularios
            var forms = getForms(idSubsidiary);
            log.error("forms", JSON.stringify(forms));

            //Si tiene retenciones se crea un invoice para cancelar el credit memo de retencion
            var idWHTInvoice = createVoidWHTInvoice(id_invoice, whtObject, forms);
            if (idWHTInvoice) {
              idWHTInvoice = setTaxDetailLinesInvoice(idWHTInvoice, whtObject);
            }

            //Se crea el credit memo de anulacion
            var idVoidCreditMemo = createVoidCreditMemo(id_invoice, invoice, idWHTInvoice, forms);
            response['idcreditmemo'] = idVoidCreditMemo;

            //Se copia los tax results de impuestos pero se relaciona al credit memo
            copyTaxResults(idVoidCreditMemo, taxResults);
          }


          //Modificando a cero los campos BASE AMOUNT/TOTAL/TOTAL BASE CURRENCY de los records del Tax Results
          for (var i = 0; i < taxResults.length; i++) {
            var id = taxResults[i]['id'];
            record.submitFields({
              type: 'customrecord_lmry_br_transaction',
              id: id,
              values: {
                'custrecord_lmry_base_amount': 0, //LATAM - BASE AMOUNT
                'custrecord_lmry_br_total': 0, //LATAM - TOTAL
                'custrecord_lmry_total_base_currency': 0 //LATAM - TOTAL BASE CURRENCY
              }
            });
          }

        }
      } catch (e) {
        response['error'] = {
          name: e.name,
          message: e.message || e
        };
        log.error('LMRY_AnulacionInvoice_LBRY_V2 - [anularInvoice]', e);
        libraryEmail.sendemail(' [ anularInvoice ] ' + e, LMRY_script);
      }

      return response;
    }

    function createVoidCreditMemo(id_invoice, invoice, idWHTInvoice, forms) {
      var idCreditMemo = '';
      log.error('[ invoice ]', invoice);
      var form = forms["creditmemoform"];

      var postingperiod = invoice.postingperiod[0].value;
      var trandate = invoice.trandate;
      var country = invoice.custbody_lmry_subsidiary_country[0].value;
      var subsidiary = invoice.subsidiary[0].value;
      var tranid = invoice.tranid;
      var totalInvoice = parseFloat(invoice.fxamount);

      var departmentInvoice;
      if (invoice.department && invoice.department.length) {
        departmentInvoice = invoice.department[0].value
      }

      var classInvoice;
      if (invoice['class'] && invoice['class'].length) {
        classInvoice = invoice['class'][0].value
      }

      var locationInvoice;
      if (invoice.location && invoice.location.length) {
        locationInvoice = invoice.location[0].value
      }

      var config = obtenerDatosConfigVoidTransaction(subsidiary);
      log.error('creditMemo form', form);
      log.error('config', JSON.stringify(config));

      if (config && form) {
        //Creando el Credit Memo
        var recordCreditMemo = record.transform({
          fromType: record.Type.INVOICE,
          fromId: id_invoice,
          toType: record.Type.CREDIT_MEMO,
          isDynamic: false,
          defaultValues: {
            'customform': form
          }
        });

        recordCreditMemo.setValue('custbody_lmry_reference_transaction', id_invoice);
        recordCreditMemo.setValue('custbody_lmry_reference_transaction_id', id_invoice);

        //seteando el campo memo del CM el tranid y el internal id del Invoice
        recordCreditMemo.setValue({
          fieldId: 'memo',
          value: 'Reference VOID ' + tranid + ' ' + '(' + id_invoice + ')'
        });

        cleanCreditMemoFields(recordCreditMemo);

        //Solo para Brasil
        if (country == 30) {
          //seteando el campo memo del CM el tranid y el internal id del Invoice
          recordCreditMemo.setValue({
            fieldId: 'custbody_lmry_num_preimpreso',
            value: id_invoice + '-DV'
          });

          var date = format.parse({
            value: trandate,
            type: format.Type.DATE
          });

          recordCreditMemo.setValue({
            fieldId: 'trandate',
            value: date
          });

          recordCreditMemo.setValue({
            fieldId: 'postingperiod',
            value: postingperiod
          });

        }

        recordCreditMemo.setValue({
          fieldId: 'taxdetailsoverride',
          value: true
        });

        recordCreditMemo.setValue({
          fieldId: 'taxregoverride',
          value: true
        });

        if (F_DEPTMANDATORY == 'T' || F_DEPTMANDATORY == true) {
          //Si el departamento en el invoice esta vacio, entonces se coloca el valor del campo "departamento" del record personalizado
          if (!departmentInvoice) {
            if (config['department']) {
              recordCreditMemo.setValue({
                fieldId: 'department',
                value: config['department']
              })
            }
          }
        }

        if (F_CLASSMANDATORY == 'T' || F_CLASSMANDATORY == true) {
          //Si la Clase en el invoice esta vacio, entonces se coloca el valor del campo "Clase" del record personalizado
          if (!classInvoice) {
            if (config['class']) {
              recordCreditMemo.setValue({
                fieldId: 'class',
                value: config['class']
              });
            }
          }
        }


        if (F_LOCMANDATORY == 'T' || F_LOCMANDATORY == true) {
          //Si la localización en el invoice esta vacio, entonces se coloca el valor del campo "localización" del record personalizado
          if (!locationInvoice) {
            if (config['location']) {
              recordCreditMemo.setValue({
                fieldId: 'location',
                value: config['location']
              });
            }
          }
        }


        //log.error('CheckBox de remover lines ', removeLines);
        if (config['removeLines'] == true) {
          //Removiendo las lineas del Credit Memo
          removeAllItems(recordCreditMemo);

          recordCreditMemo.insertLine({
            sublistId: 'item',
            line: 0
          });

          if (config['item']) {
            recordCreditMemo.setSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              line: 0,
              value: config['item']
            });
          }

          if (F_MULTPRICE == true || F_MULTPRICE == 'T') {
            recordCreditMemo.setSublistValue({
              sublistId: 'item',
              fieldId: 'price',
              line: 0,
              value: -1
            });
          }

          recordCreditMemo.setSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            line: 0,
            value: totalInvoice
          });
          recordCreditMemo.setSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            line: 0,
            value: totalInvoice
          });

          if (F_DEPARTMENTS == true || F_DEPARTMENTS == 'T') {
            var department_line = departmentInvoice || config['department'];
            if (department_line) {
              recordCreditMemo.setSublistValue({
                sublistId: 'item',
                fieldId: 'department',
                line: 0,
                value: department_line
              });
            }
          }

          if (F_CLASSES == true || F_CLASSES == 'T') {
            var class_line = classInvoice || config['class'];
            if (class_line) {
              recordCreditMemo.setSublistValue({
                sublistId: 'item',
                fieldId: 'class',
                line: 0,
                value: class_line
              });
            }
          }

          if (F_LOCATIONS == true || F_LOCATIONS == 'T') {
            var location_line = locationInvoice || config['location'];
            if (location_line) {
              recordCreditMemo.setSublistValue({
                sublistId: 'item',
                fieldId: 'location',
                line: 0,
                value: location_line
              });
            }
          }
        }


        //Invoice que se aplicaran
        var invoicesToApply = [Number(id_invoice)];
        //Si hubo retencion tambien se aplicar el invoice creado para cancelar la retencion.
        if (idWHTInvoice) {
          invoicesToApply.push(Number(idWHTInvoice));
        }

        var numApply = recordCreditMemo.getLineCount({
          sublistId: 'apply'
        });

        var countApplieds = 0;

        for (var i = 0; i < numApply; i++) {
          var lineTransaction = recordCreditMemo.getSublistValue({
            sublistId: 'apply',
            fieldId: 'internalid',
            line: i
          });

          if (invoicesToApply.indexOf(Number(lineTransaction)) != -1) {
            recordCreditMemo.setSublistValue({
              sublistId: 'apply',
              fieldId: 'apply',
              line: i,
              value: true
            });

            countApplieds++;
          }

          if (countApplieds == invoicesToApply.length) {
            break;
          }
        }

        //Guardando el CreditMemo
        idCreditMemo = recordCreditMemo.save({
          ignoreMandatoryFields: true,
          disableTriggers: true,
          enableSourcing: true
        });

        if (config['removeLines'] == true) {
          idCreditMemo = setTaxDetailLinesCreditMemo(invoice, idCreditMemo, config);
        }

        log.error('idCreditMemo', idCreditMemo);
      }
      return idCreditMemo;
    }

    function setTaxDetailLinesCreditMemo(invoice, idCreditMemo, config) {

      try {

        var transId = invoice.internalid[0].value;

        var transObj = record.load({
          type: 'invoice',
          id: transId,
          isDynamic: false
        });

        var nexus = transObj.getValue({
          fieldId: 'nexus'
        });
        var transactionType = transObj.getValue({
          fieldId: 'custbody_ste_transaction_type'
        });
        var subTaxRegNumber = transObj.getValue({
          fieldId: 'subsidiarytaxregnum'
        });
        var entityTaxRegNumber = transObj.getValue({
          fieldId: 'entitytaxregnum'
        });

        var recordObj = record.load({
          type: 'creditmemo',
          id: idCreditMemo,
          isDynamic: false
        });

        while (true) {
          var taxDetailLines = recordObj.getLineCount({
            sublistId: 'taxdetails'
          });
          if (taxDetailLines) {
            recordObj.removeLine({
              sublistId: 'taxdetails',
              line: taxDetailLines - 1
            });
          } else {
            break;
          }
        }

        recordObj.setValue('nexus', nexus);
        recordObj.setValue('custbody_ste_transaction_type', transactionType);
        recordObj.setValue('subsidiarytaxregnum', subTaxRegNumber);
        recordObj.setValue('entitytaxregnum', entityTaxRegNumber);

        var searchObj = search.create({
          type: 'salestaxitem',
          columns: [{
            name: 'internalid'
          }, {
            name: 'internalid',
            join: 'taxType'
          }],
          filters: [
            ["taxtype.country", "anyof", "BR"],
            "AND",
            ["taxtype.isinactive", "is", "F"],
            "AND",
            ["taxtype.doesnotaddtototal", "is", "F"],
            "AND",
            ["taxtype.name", "is", "VAT_BR"],
            "AND",
            ["name", "startswith", "UNDEF"],
            "AND",
            ["isinactive", "is", "F"]
          ]
        }).run().getRange(0, 10);
        var searchColumns = searchObj[0].columns;
        var taxCode = searchObj[0].getValue(searchColumns[0]);
        var taxType = searchObj[0].getValue(searchColumns[1]);

        var lineCount = recordObj.getLineCount({
          sublistId: 'item'
        });

        for (var i = 0; i < lineCount; i++) {

          var itemDetailsReference = recordObj.getSublistValue({
            sublistId: 'item',
            fieldId: 'taxdetailsreference',
            line: i
          });

          recordObj.insertLine({
            sublistId: 'taxdetails',
            line: i
          });

          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxdetailsreference',
            line: i,
            value: itemDetailsReference
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxtype',
            line: i,
            value: taxType
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxcode',
            line: i,
            value: taxCode
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxbasis',
            line: i,
            value: 0.00
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxrate',
            line: i,
            value: 0.00
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxamount',
            line: i,
            value: 0.00
          });

        }

        var recordId = recordObj.save({
          ignoreMandatoryFields: true,
          disableTriggers: true,
          enableSourcing: true
        });

        return recordId;

      } catch (e) {
        log.error('[ setTaxDetailLinesCreditMemo ]', e);
      }

    }

    function cleanCreditMemoFields(recordObj) {
      recordObj.setValue('custbody_lmry_foliofiscal', ''); //LATAM - FISCAL FOLIO
      recordObj.setValue('custbody_lmry_num_preimpreso', '') //LATAM - PREPRINTED NUMBER
      recordObj.setValue('custbody_lmry_num_doc_ref', ''); //LATAM - DOCUMENT NUMBER REF
      recordObj.setValue('custbody_lmry_doc_ref_date', ''); //LATAM - DOCUMENT DATE REF
      recordObj.setValue('custbody_lmry_doc_serie_ref', ''); //LATAM - DOCUMENT SERIES REF
      recordObj.setValue('custbody_exchange_rate_doc_ref', ''); //LATAM - TYPE CHANGE DOC REF
      recordObj.setValue('custbody_doc_ref_type', ''); //LATAM - DOCUMENT TYPE REF
      recordObj.setValue('custbody_lmry_document_type', ''); //LATAM - LEGAL DOCUMENT TYPE
      recordObj.setValue('custbody_lmry_serie_doc_cxc', ''); //LATAM - SERIE CXC
      recordObj.setValue('custbody_lmry_mx_document_design', ''); //LATAM - MX DOCUMENT DESIGN
      recordObj.setValue('custbody_lmry_paymentmethod', ''); //LATAM - PAYMENT METHOD
      recordObj.setValue('custbody_lmry_entity_bank', ''); //LATAM - ENTITY BANK
      recordObj.setValue('custbody_lmry_entity_bank_account', ''); //LATAM - ENTITY BANK ACCOUNT
      recordObj.setValue('custbody_lmry_entity_bank_code', ''); //LATAM - ENTITY BANK CODE
      recordObj.setValue('custbody_lmry_entityforeingbank', ''); //LATAM FOREIGN ENTITY BANK
      recordObj.setValue('custbody_foliofiscal_doc_ref', ''); //LATAM - FOLIO FISCAL REF
      recordObj.setValue('custbody_lmry_informacion_adicional', ''); //LATAM - ADDITIONAL INFORMATION
      recordObj.setValue('custbody_lmry_mx_uso_cfdi', ''); //LATAM - MX USECFDI
      recordObj.setValue('custbody_lmry_mx_paymentmethod', ''); //LATAM - MX EI PAYMENT METHOD
      recordObj.setValue('custbody_lmry_mx_tipo_relacion', ''); //LATAM - MX RELATIONTYPE
      recordObj.setValue('custbody_lmry_pe_estado_sf', ''); //LATAM - MX ESTADO SF
      recordObj.setValue('custbody_lmry_serie_doc_loc_cxc', ''); //LATAM - CXC LOCATION SERIES
      recordObj.setValue('custbody_lmry_carga_inicial', false); //LATAM - INITIAL LOAD?
      recordObj.setValue('custbody_lmry_apply_wht_code', false); // LATAM - APPLIED WHT CODE
      recordObj.setValue('custbody_psg_ei_template', ''); // E-DOCUMENT TEMPLATE
      recordObj.setValue('custbody_psg_ei_status', ''); // E-DOCUMENT STATUS
      recordObj.setValue('custbody_psg_ei_sending_method', ''); //E-DOCUMENT SENDING METHODS
      recordObj.setValue('custbody_psg_ei_generated_edoc', ''); //GENERATED E-DOCUMENT
    }

    function obtenerDatosConfigVoidTransaction(id_subsidiaria) {
      try {
        var config = {};
        //busqueda del record customrecord_lmry_config_voidtransaction para la config: Void Transaction

        var columns = ['custrecord_lmry_configvoid_subsidiary', 'custrecord_lmry_configvoid_item',
          'custrecord_lmry_configvoid_taxcode', 'custrecord_lmry_configvoid_removelines'
        ];

        if (F_DEPARTMENTS == true || F_DEPARTMENTS == 'T') {
          columns.push("custrecord_lmry_configvoid_department");
        }

        if (F_CLASSES == true || F_CLASSES == 'T') {
          columns.push("custrecord_lmry_configvoid_class");
        }

        if (F_LOCATIONS == true || F_LOCATIONS == 'T') {
          columns.push("custrecord_lmry_configvoid_location");
        }

        var searchConfigVoidTransaction = search.create({
          type: 'customrecord_lmry_config_voidtransaction',
          columns: columns,
          filters: ['custrecord_lmry_configvoid_subsidiary', 'is', id_subsidiaria]
        });
        var searchResult = searchConfigVoidTransaction.run().getRange(0, 1);

        if (searchResult != '' && searchResult != null) {
          config['item'] = searchResult[0].getValue({
            name: 'custrecord_lmry_configvoid_item'
          });
          config['taxCode'] = searchResult[0].getValue({
            name: 'custrecord_lmry_configvoid_taxcode'
          });
          config['department'] = searchResult[0].getValue({
            name: 'custrecord_lmry_configvoid_department'
          });
          config['class'] = searchResult[0].getValue({
            name: 'custrecord_lmry_configvoid_class'
          });
          config['location'] = searchResult[0].getValue({
            name: 'custrecord_lmry_configvoid_location'
          });
          config['removeLines'] = searchResult[0].getValue({
            name: 'custrecord_lmry_configvoid_removelines'
          });
        }

        return config;
      } catch (err) {
        log.error('LMRY_AnulacionInvoice_LBRY_V2 - [obtenerDatosConfigVoidTransaction]', err);
        libraryEmail.sendemail(' [ obtenerDatosConfigVoidTransaction ] ' + err, LMRY_script);
      }
    }

    function getWithholdingTax(idTransaction) {
      var whtObject = {};

      var columns = [
        "internalid", "mainline", "trandate", "subsidiary", "exchangerate", "currency", "postingperiod",
        "account", "fxamount", "item", "memo", "line",
        search.createColumn({
          name: "linesequencenumber",
          sort: search.Sort.ASC
        })
      ];

      if (F_DEPARTMENTS == true || F_DEPARTMENTS == 'T') {
        columns.push("department");
      }

      if (F_CLASSES == true || F_CLASSES == 'T') {
        columns.push("class");
      }

      if (F_LOCATIONS == true || F_LOCATIONS == 'T') {
        columns.push("location");
      }

      if (F_JOBS == true || F_JOBS == 'T') {
        columns.push("customerMain.internalid");
      } else {
        columns.push("customer.internalid");
      }

      var search_wht = search.create({
        type: "creditmemo",
        filters: [
          ["createdfrom", "anyof", idTransaction], "AND",
          ["memomain", "startswith", MEMO_WHT], "AND",
          ["taxline", "is", "F"], "AND",
          ["formulatext: {item.type.id}", "doesnotstartwith", "ShipItem"]
        ],
        columns: columns,
        settings: [
          search.createSetting({
            name: 'consolidationtype',
            value: 'NONE'
          })
        ]
      });

      var results = search_wht.run().getRange(0, 1000);

      if (results && results.length) {
        var idCreditMemo = results[0].getValue('internalid');

        var customer = "";
        if (F_JOBS == true || F_JOBS == 'T') {
          customer = results[0].getValue({
            join: "customerMain",
            name: "internalid"
          });
        } else {
          customer = results[0].getValue({
            join: "customer",
            name: "internalid"
          });
        }

        var subsidiary = results[0].getValue('subsidiary');
        var trandate = results[0].getValue('trandate');
        trandate = format.parse({
          value: trandate,
          type: format.Type.DATE
        });
        var postingperiod = results[0].getValue('postingperiod');
        var currency = results[0].getValue('currency');
        var exchangerate = results[0].getValue('exchangerate');
        var account = results[0].getValue('account');

        var department = results[0].getValue('department');
        var class_ = results[0].getValue('class');
        var location = results[0].getValue('location');

        whtObject = {
          id: idCreditMemo,
          customer: customer,
          subsidiary: subsidiary,
          trandate: trandate,
          postingperiod: postingperiod,
          currency: currency,
          exchangerate: exchangerate,
          account: account,
          department: department,
          'class': class_,
          location: location,
          lines: []
        };

        var transObj = record.load({
          type: 'creditmemo',
          id: idCreditMemo,
          isDynamic: false
        });

        for (var i = 0; i < results.length; i++) {
          var mainline = results[i].getValue('mainline');
          var item = results[i].getValue('item');
          var amount = results[i].getValue('fxamount');
          amount = Math.abs(parseFloat(amount));
          var memo = results[i].getValue('memo');
          var department_line = results[i].getValue('department');
          var class_line = results[i].getValue('class');
          var location_line = results[i].getValue('location');

          if (mainline != '*' && item) {

            var taxType = transObj.getSublistValue('taxdetails', 'taxtype', i-1);
            var taxCode = transObj.getSublistValue('taxdetails', 'taxcode', i-1);
            var taxBasis = transObj.getSublistValue('taxdetails', 'taxbasis', i-1);
            var taxRate = transObj.getSublistValue('taxdetails', 'taxrate', i-1);

            whtObject['lines'].push({
              item: item,
              amount: amount,
              taxtype: taxType,
              taxcode: taxCode,
              taxbasis: taxBasis,
              taxrate: taxRate,
              memo: memo,
              department: department_line,
              'class': class_line,
              location: location_line
            });
          }
        }
      }

      return whtObject;
    }

    function createVoidWHTInvoice(idTransaction, whtObject, forms) {
      try {
        var idWHTInvoice = '';
        if (whtObject['id']) {
          var form = forms["invoiceform"];

          if (whtObject['customer'] && form) {
            var invoiceObj = record.transform({
              fromType: 'customer',
              fromId: whtObject['customer'],
              toType: 'invoice',
              isDynamic: false
            });

            invoiceObj.setValue('customform', form);
            invoiceObj.setValue('trandate', new Date());
            invoiceObj.setValue('subsidiary', whtObject['subsidiary']);
            invoiceObj.setValue('account', whtObject['account']);
            invoiceObj.setValue('currency', whtObject['currency']);
            invoiceObj.setValue('exchangerate', whtObject['exchangerate']);
            invoiceObj.setValue('memo', MEMO_VOID_WHT);
            invoiceObj.setValue('custbody_lmry_reference_transaction', idTransaction);
            invoiceObj.setValue('custbody_lmry_reference_transaction_id', idTransaction);
            invoiceObj.setValue('custbody_lmry_reference_entity', whtObject['customer']);

            // Tax Details subtab fields
            invoiceObj.setValue('taxdetailsoverride', true);

            var F_APPROVAL_INVOICE = runtime.getCurrentScript().getParameter({
              name: "CUSTOMAPPROVALCUSTINVC"
            });

            if (F_APPROVAL_INVOICE && invoiceObj.getField({
                fieldId: 'approvalstatus'
              })) {
              invoiceObj.setValue('approvalstatus', 2);
            }

            if ((F_DEPARTMENTS == 'T' || F_DEPARTMENTS == true) && whtObject['department']) {
              invoiceObj.setValue('department', whtObject['department']);
            }

            if ((F_CLASSES == 'T' || F_CLASSES == true) && whtObject['class']) {
              invoiceObj.setValue('class', whtObject['class']);
            }

            if ((F_LOCATIONS == 'T' || F_LOCATIONS == true) && whtObject['location']) {
              invoiceObj.setValue('location', whtObject['location']);
            }


            for (var i = 0; i < whtObject['lines'].length; i++) {
              var line = whtObject['lines'][i];
              invoiceObj.insertLine({
                sublistId: 'item',
                line: i
              });
              invoiceObj.setSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i,
                value: line['item']
              });

              if (F_MULTPRICE) {
                invoiceObj.setSublistValue({
                  sublistId: 'item',
                  fieldId: 'price',
                  line: i,
                  value: -1
                });
              }

              invoiceObj.setSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                line: i,
                value: line['amount']
              });
              invoiceObj.setSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                line: i,
                value: line['amount']
              });
              invoiceObj.setSublistValue({
                sublistId: 'item',
                fieldId: 'description',
                line: i,
                value: "VOID - " + line['memo']
              });

              if ((F_DEPARTMENTS == 'T' || F_DEPARTMENTS == true) && line['department']) {
                invoiceObj.setSublistValue({
                  sublistId: 'item',
                  fieldId: 'department',
                  line: i,
                  value: line['department']
                })
              }

              if ((F_CLASSES == 'T' || F_CLASSES == true) && line['class']) {
                invoiceObj.setSublistValue({
                  sublistId: 'item',
                  fieldId: 'class',
                  line: i,
                  value: line['class']
                })
              }

              if ((F_LOCATIONS == 'T' || F_LOCATIONS == true) && line['location']) {
                invoiceObj.setSublistValue({
                  sublistId: 'item',
                  fieldId: 'location',
                  line: i,
                  value: line['location']
                })
              }
            }

            idWHTInvoice = invoiceObj.save({
              ignoreMandatoryFields: true,
              disableTriggers: true,
              enableSourcing: true
            });
          }
        }

        log.error('idWHTInvoice', idWHTInvoice);
        return idWHTInvoice;
      } catch (err) {
        log.error('[ createVoidWHTInvoice ]', err);
        libraryEmail.sendemail(' [ createVoidWHTInvoice ] ' + err, LMRY_script);
      }
    }

    function setTaxDetailLinesInvoice(idInvoice, whtObject) {

      try {
        log.error('[ whtObject ]', whtObject);
        var creditMemoId = whtObject['id'];

        var creditMemoObj = record.load({
          type: 'creditmemo',
          id: creditMemoId,
          isDynamic: false
        });

        var nexus = creditMemoObj.getValue('nexus');
        var nexusOverRide = creditMemoObj.getValue('taxregoverride');
        var transactionType = creditMemoObj.getValue('custbody_ste_transaction_type');
        var subTaxRegNumber = creditMemoObj.getValue('subsidiarytaxregnum');
        var entityTaxRegNumber = creditMemoObj.getValue('entitytaxregnum');

        var recordObj = record.load({
          type: 'invoice',
          id: idInvoice,
          isDynamic: false
        });

        recordObj.setValue('nexus', nexus);
        recordObj.setValue('taxregoverride', nexusOverRide);
        if (transactionType && transactionType != null && transactionType != "" && transactionType != " ") {
          recordObj.setValue('custbody_ste_transaction_type', transactionType);
        }
        recordObj.setValue('subsidiarytaxregnum', subTaxRegNumber);
        recordObj.setValue('entitytaxregnum', entityTaxRegNumber);

        var lineCount = recordObj.getLineCount({
          sublistId: 'item'
        });

        for (var i = 0; i < lineCount; i++) {

          var line = whtObject['lines'][i];

          var itemDetailsReference = recordObj.getSublistValue({
            sublistId: 'item',
            fieldId: 'taxdetailsreference',
            line: i
          });

          recordObj.insertLine({
            sublistId: 'taxdetails',
            line: i
          });

          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxdetailsreference',
            line: i,
            value: itemDetailsReference
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxtype',
            line: i,
            value: line['taxtype']
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxcode',
            line: i,
            value: line['taxcode']
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxbasis',
            line: i,
            value: line['taxbasis']
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxrate',
            line: i,
            value: line['taxrate']
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxamount',
            line: i,
            value: 0.00
          });

        }

        var recordId = recordObj.save({
          ignoreMandatoryFields: true,
          disableTriggers: true,
          enableSourcing: true
        });

        return recordId;

      } catch (e) {
        log.error('[ setTaxDetailLinesInvoice ]', e);
        libraryEmail.sendemail('[ setTaxDetailLinesInvoice ]' + e, LMRY_script);
      }

    }

    function getTaxResults(recordId) {
      var taxResults = [];
      if (recordId) {
        var searchTaxResults = search.create({
          type: 'customrecord_lmry_br_transaction',
          filters: [
            ['custrecord_lmry_br_transaction', 'anyof', recordId]
          ],
          columns: ['internalid', 'custrecord_lmry_tax_type']
        });

        var results = searchTaxResults.run().getRange(0, 1000);
        if (results) {
          for (var i = 0; i < results.length; i++) {
            taxResults.push({
              taxtype: results[i].getValue('custrecord_lmry_tax_type'),
              id: results[i].getValue('internalid')
            });
          }
        }
      }
      return taxResults;
    }

    function copyTaxResults(idCreditMemo, taxResults) {
      for (var i = 0; i < taxResults.length; i++) {
        var taxtype = taxResults[i]['taxtype'];
        if (Number(taxtype) == 4) { //Impuesto
          var id = taxResults[i]['id'];
          var taxResultObj = record.copy({
            type: "customrecord_lmry_br_transaction",
            id: id
          });
          taxResultObj.setValue('custrecord_lmry_br_transaction', idCreditMemo);
          taxResultObj.setValue('custrecord_lmry_br_related_id', parseInt(idCreditMemo));
          taxResultObj.save({
            ignoreMandatoryFields: true,
            disableTriggers: true,
            enableSourcing: true
          });
        }
      }
    }

    function voidWHTCreditMemo(idCreditMemo) {
      if (idCreditMemo) {
        var creditMemoObj = record.load({
          type: "creditmemo",
          id: idCreditMemo
        });

        var idInvoice = creditMemoObj.getValue('custbody_lmry_reference_transaction');

        var numApply = creditMemoObj.getLineCount({
          sublistId: 'apply'
        });

        for (var i = 0; i < numApply; i++) {
          var lineTransaction = creditMemoObj.getSublistValue({
            sublistId: 'apply',
            fieldId: 'internalid',
            line: i
          });

          if (Number(lineTransaction) == Number(idInvoice)) {
            creditMemoObj.setSublistValue({
              sublistId: 'apply',
              fieldId: 'apply',
              line: i,
              value: false
            });
            break;
          }
        }

        creditMemoObj.save({
          ignoreMandatoryFields: true,
          disableTriggers: true,
          enableSourcing: true
        });

        transaction.void({
          type: "creditmemo",
          id: idCreditMemo
        });
      }
    }

    function validateBeforeVoidInvoice(idInvoice) {
      var search_paymts = search.create({
        type: "transaction",
        filters: [

          ["type", "anyof", "CustPymt", "CustCred"],
          "AND", ["mainline", "is", "T"], "AND",
          ["memomain", "doesnotstartwith", MEMO_WHT], "AND",
          ["appliedtotransaction", "anyof", idInvoice]
        ],
        columns: ["internalid", "appliedtotransaction"]
      });


      var results = search_paymts.run().getRange(0, 10);

      if (results && results.length) {
        return false;
      }
      return true;
    }


    function removeAllItems(recordObj) {
      while (true) {
        var numberItems = recordObj.getLineCount({
          sublistId: 'item'
        });
        if (numberItems) {
          recordObj.removeLine({
            sublistId: 'item',
            line: numberItems - 1
          });
          recordObj.removeLine({
            sublistId: 'taxdetails',
            line: numberItems - 1
          });
        } else {
          break;
        }
      }
    }

    function getForms(idSubsidiary) {
      var forms = {};
      if (idSubsidiary) {
        var search_setup = search.create({
          type: 'customrecord_lmry_setup_tax_subsidiary',
          filters: [
            ['custrecord_lmry_setuptax_subsidiary', 'anyof', idSubsidiary], 'AND',
            ['isinactive', 'is', 'F']
          ],
          columns: ['internalid', 'custrecord_lmry_setuptax_form_invoice', 'custrecord_lmry_setuptax_form_creditmemo']
        });

        var results = search_setup.run().getRange(0, 10);
        if (results && results.length) {
          forms['invoiceform'] = results[0].getValue('custrecord_lmry_setuptax_form_invoice') || '';
          forms['creditmemoform'] = results[0].getValue('custrecord_lmry_setuptax_form_creditmemo') || '';
        }
      }

      return forms;
    }

    return {
      anularInvoice: anularInvoice,
      validateBeforeVoidInvoice: validateBeforeVoidInvoice
    };

  });
