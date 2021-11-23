/*= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
  ||  This script for customer center                             ||
  ||                                                              ||
  ||  File Name:  LMRY_Archivo_Retorno_MPRD.js                    ||
  ||                                                              ||
  ||  Version Date         Author        Remarks                  ||
  ||  2.0     Oct 03 2019  LatamReady    Bundle 37714             ||
   \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/log', 'N/record', 'N/search', 'N/format', 'N/runtime', 'N/url', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './WTH_Library/LMRY_BR_WHT_CustPaymnt_LBRY'],

  function(log, record, search, format, runtime, url, library_email, library_custpayment) {

    var LMRY_script = 'LatamReady - BR Archivo Retorno MPRD';

    var scriptObj = runtime.getCurrentScript();
    var userid = scriptObj.getParameter({
      name: 'custscript_lmry_br_return_user'
    });
    var logid = scriptObj.getParameter({
      name: 'custscript_lmry_br_return_state'
    });

    var F_DEPARTMENTS = runtime.isFeatureInEffect({
      feature: "DEPARTMENTS"
    });
    var F_LOCATIONS = runtime.isFeatureInEffect({
      feature: "LOCATIONS"
    });
    var F_CLASSES = runtime.isFeatureInEffect({
      feature: "CLASSES"
    });

    var FEAT_INSTALLMENTS = runtime.isFeatureInEffect({
      feature: "installments"
    });

    /**
     * SuiteTax Feature
     */
    var F_SUITETAX = false;

    /**
     * Input Data for processing
     *
     * @return Array,Object,Search,File
     *
     * @since 2016.1
     */
    function getInputData() {

      try {

        log.error('Log y User', logid + "-" + userid);

        F_SUITETAX = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var record_return = record.load({
          type: 'customrecord_lmry_br_log_return_file',
          id: logid
        });

        var search_return = record_return.getValue('custrecord_lmry_br_log_return_invoice').split('|');
        var subsidiary = record_return.getValue('custrecord_lmry_br_log_return_subsidiary');
        var bank = record_return.getValue('custrecord_lmry_br_log_return_bank');

        record_return.setValue({
          fieldId: 'custrecord_lmry_br_log_return_user',
          value: userid
        });
        record_return.setValue({
          fieldId: 'custrecord_lmry_br_log_return_state',
          value: 'Procesando'
        });

        record_return.save();

        var invoices = [];
        var json_invoice = [];
        /*var json_amount = {};
        var json_interest = {};
        var json_discount = {};
        var json_date = {};*/

        var json_data = {};
        for (var i = 0; i < search_return.length; i++) {
          var aux_return = search_return[i].split(';');
          if (invoices.indexOf(aux_return[0]) == -1) {
            invoices.push(aux_return[0]);
          }

          /*json_amount[aux_return[0]] = aux_return[1];
          json_interest[aux_return[0]] = aux_return[2];
          json_discount[aux_return[0]] = aux_return[3];
          json_date[aux_return[0]] = aux_return[4];*/

          if (F_SUITETAX === true || F_SUITETAX === "T") {
            // SUITETAX
            if (json_data[aux_return[0]]) {
              json_data[aux_return[0]].push({
                installment: aux_return[1],
                amount: aux_return[2],
                interest: aux_return[3],
                discount: 0,
                date: aux_return[5]
              });
            } else {
              json_data[aux_return[0]] = [{
                installment: aux_return[1],
                amount: aux_return[2],
                interest: aux_return[3],
                discount: 0,
                date: aux_return[5]
              }];
            }

          } else {
            // LEGACYTAX
            if (json_data[aux_return[0]]) {
              json_data[aux_return[0]].push({
                installment: aux_return[1],
                amount: aux_return[2],
                interest: aux_return[3],
                discount: aux_return[4],
                date: aux_return[5]
              });
            } else {
              json_data[aux_return[0]] = [{
                installment: aux_return[1],
                amount: aux_return[2],
                interest: aux_return[3],
                discount: aux_return[4],
                date: aux_return[5]
              }];
            }

          }

        }

        //Segmentacion
        var customSegments = getCustomSegments();

        var columnsInvoice = ['internalid', 'entity', 'account', 'currency', 'subsidiary'];

        if (F_DEPARTMENTS == true || F_DEPARTMENTS == 'T') {
          columnsInvoice.push("department");
        }
        if (F_CLASSES == true || F_CLASSES == 'T') {
          columnsInvoice.push("class");
        }
        if (F_LOCATIONS == true || F_LOCATIONS == 'T') {
          columnsInvoice.push("location");
        }

        for (var i = 0; i < customSegments.length; i++) {
          var customSegmentId = customSegments[i];
          columnsInvoice.push(customSegmentId);
        }

        var search_invoice = search.create({
          type: search.Type.INVOICE,
          columns: columnsInvoice,
          filters: [{
              name: 'internalid',
              operator: 'anyof',
              values: invoices
            },
            {
              name: 'mainline',
              operator: 'is',
              values: 'T'
            },
            {
              name: 'status',
              operator: 'is',
              values: 'CustInvc:A'
            }
          ]
        });

        var result_invoice = search_invoice.run().getRange({
          start: 0,
          end: 1000
        });

        var k = 0;
        if (result_invoice != '' && result_invoice.length > 0) {
          for (var i = 0; i < result_invoice.length; i++) {
            var internalid = result_invoice[i].getValue('internalid');
            for (var j = 0; j < json_data[internalid].length; j++) {

              json_invoice.push({
                key: k,
                values: {
                  internalid: internalid,
                  installment: json_data[internalid][j]['installment'],
                  entity: result_invoice[i].getValue('entity'),
                  account: result_invoice[i].getValue('account'),
                  currency: result_invoice[i].getValue('currency'),
                  subsidiary: subsidiary ? subsidiary : 1,
                  bank: bank,
                  amount: json_data[internalid][j]['amount'],
                  interest: json_data[internalid][j]['interest'],
                  discount: json_data[internalid][j]['discount'],
                  date: json_data[internalid][j]['date']
                }
              });

              if (F_DEPARTMENTS == 'T' || F_DEPARTMENTS == true) {
                json_invoice[k]['values']['department'] = result_invoice[i].getValue('department') || 0;
              }
              if (F_CLASSES == 'T' || F_CLASSES == true) {
                json_invoice[k]['values']['class'] = result_invoice[i].getValue('class') || 0;
              }
              if (F_LOCATIONS == 'T' || F_LOCATIONS == true) {
                json_invoice[k]['values']['location'] = result_invoice[i].getValue('location') || 0;
              }
              if (customSegments.length) {
                for (var l = 0; l < customSegments.length; l++) {
                  json_invoice[k]['values'][customSegments[l]] = result_invoice[i].getValue(customSegments[l]) || 0;
                }
              }
              k++;
            }
          }
        }

        return json_invoice;

      } catch (err) {
        library_email.sendemail('[ getInputData ]' + err, LMRY_script);
        log.error('[ getInputData ]', err);
      }

    }


    /**
     * If this entry point is used, the map function is invoked one time for each key/value.
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation represents a restart
     * @param {number} context.executionNo - Version of the bundle being installed
     * @param {Iterator} context.errors - This param contains a "iterator().each(parameters)" function
     * @param {string} context.key - The key to be processed during the current invocation
     * @param {string} context.value - The value to be processed during the current invocation
     * @param {function} context.write - This data is passed to the reduce stage
     *
     * @since 2016.1
     */
    function map(context) {

      try {
        var massive_inv = JSON.parse(context.value);

        F_SUITETAX = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var id = massive_inv.values.internalid;
        var installment = massive_inv.values.installment;
        var customer = massive_inv.values.entity;
        var account = massive_inv.values.account;
        var currency = massive_inv.values.currency;
        var amount = massive_inv.values.amount;
        var interes = massive_inv.values.interest;
        var discount = massive_inv.values.discount;
        var subsidiary = massive_inv.values.subsidiary;
        var bank = massive_inv.values.bank;
        var date = massive_inv.values.date;

        var department = 0
        if (F_DEPARTMENTS == 'T' || F_DEPARTMENTS == true) {
          department = massive_inv.values.department;
        }
        var class_ = 0;
        if (F_CLASSES == 'T' || F_CLASSES == true) {
          class_ = massive_inv.values.class;
        }
        var location = 0;
        if (F_LOCATIONS == 'T' || F_LOCATIONS == true) {
          location = massive_inv.values.location;
        }

        var customSegments = getCustomSegments();
        var segment = [];
        for (var k = 0; k < customSegments.length; k++) {
          segment.push(customSegments[k] + ';' + massive_inv.values[customSegments[k]]);

        }

        var keyconcat = customer + "|" + account + "|" + currency + "|" + date + "|" + department + "|" + class_ + "|" + location;
        if (segment.length) {
          keyconcat = keyconcat + "|" + segment.join('|');
        }

        context.write({
          key: keyconcat,
          value: {
            type: 'inv',
            value: id,
            amount: amount,
            interes: interes,
            discount: discount,
            subsidiary: subsidiary,
            bank: bank,
            installment: installment
          }
        });

      } catch (err) {
        library_email.sendemail('[ map ]' + err, LMRY_script);
        log.error('[ map ]', err);
      }

    }


    /**
     * If this entry point is used, the reduce function is invoked one time for
     * each key and list of values provided..
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation represents a restart
     * @param {number} context.executionNo - Version of the bundle being installed
     * @param {Iterator} context.errors - This param contains a "iterator().each(parameters)" function
     * @param {string} context.key - The key to be processed during the current invocation
     * @param {string} context.value - The value to be processed during the current invocation
     * @param {function} context.write - This data is passed to the reduce stage
     *
     * @since 2016.1
     */
    function reduce(context) {

      try {

        F_SUITETAX = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var invoicesData = context.values;
        var array_moras = [];
        var array_pagos = [];

        var massive_key = context.key;
        var currency_mora = massive_key.split('|')[2];
        var fechaprev = massive_key.split('|')[3];
        var department = massive_key.split('|')[4];
        var class_ = massive_key.split('|')[5];
        var location = massive_key.split('|')[6];

        var segment = massive_key.split('|');
        var segmentJson = {
          name: [],
          value: []
        };

        for (var i = 6; i < segment.length; i++) {
          segmentJson.name.push(segment[i].split(';')[0]);
          segmentJson.value.push(segment[i].split(';')[1]);
        }

        var fecha = new Date(parseInt('20' + fechaprev.substring(4, 6)), parseInt(fechaprev.substring(2, 4)) - 1, fechaprev.substring(0, 2));

        var concatenado = '';
        var flag_mora = false;
        var approvalFeature = runtime.getCurrentScript().getParameter({
          name: 'CUSTOMAPPROVALCUSTINVC'
        });
        var featureSubs = runtime.isFeatureInEffect({
          feature: "SUBSIDIARIES"
        });

        //Obtener Cuenta Bank
        var data = JSON.parse(invoicesData[0]);
        var subsidiary = parseInt(data.subsidiary);
        var bank = parseInt(data.bank);
        var idConfig = 0,
          idAccount = 0,
          idAccountMora = 0,
          interestItem = 0,
          discountItem = 0;

        var brTranSearch = search.create({
          type: 'customrecord_lmry_br_config_bank_ticket',
          columns: ['internalid', 'custrecord_lmry_br_interest_item', 'custrecord_lmry_br_discount_item'],
          filters: [
            ['custrecord_lmry_pdf_bank', 'is', bank], 'AND',
            ['isinactive', 'is', 'F']
          ]
        });
        if (featureSubs) {
          brTranSearch.filters.push(search.createFilter({
            name: 'custrecord_lmry_name_subsidiary',
            operator: 'is',
            values: subsidiary
          }));
        }
        brTranSearch = brTranSearch.run().getRange(0, 1);
        if (brTranSearch != null && brTranSearch != '') {
          idConfig = brTranSearch[0].getValue('internalid');
          interestItem = brTranSearch[0].getValue('custrecord_lmry_br_interest_item');
          discountItem = brTranSearch[0].getValue('custrecord_lmry_br_discount_item');
          var configPaySearch = search.create({
            type: 'customrecord_lmry_br_config_bank_payment',
            columns: ['custrecord_lmry_br_bank_account', 'custrecord_lmry_br_interest'],
            filters: [
              ['custrecord_lmry_br_config', 'is', idConfig], 'AND',
              ['custrecord_lmry_br_currency', 'is', currency_mora], 'AND',
              ['isinactive', 'is', 'F']
            ]
          });
          configPaySearch = configPaySearch.run().getRange(0, 1000);
          if (configPaySearch != null && configPaySearch != '') {
            for (var i = 0; i < configPaySearch.length; i++) {
              var isInterest = configPaySearch[i].getValue('custrecord_lmry_br_interest');
              if (isInterest == true || isInterest == 'T') {
                idAccountMora = configPaySearch[i].getValue('custrecord_lmry_br_bank_account');
              } else {
                idAccount = configPaySearch[i].getValue('custrecord_lmry_br_bank_account');
              }
            }
            if (idAccountMora == null || idAccountMora == '' || idAccountMora == 0) {
              idAccountMora = idAccount;
            }
          }
        }

        /*var configSearch = search.create({
                  type: 'customrecord_lmry_br_config_bank_ticket',
                  columns: ['internalid'],
                  filters: [['custrecord_lmry_name_subsidiary', 'is', subsidiary], 'AND', ['isinactive', 'is', 'F']]
                });
                configSearch = configSearch.run().getRange(0, 1);
                if (configSearch != null && configSearch != '') {
                  idConfig = configSearch[0].getValue('internalid');
                  //Busqueda de la cuenta Bank
                  var configPaySearch = search.create({
                    type: 'customrecord_lmry_br_config_bank_payment',
                    columns: ['custrecord_lmry_br_bank_account'],
                    filters: [
                      ['custrecord_lmry_br_config', 'is', idConfig], 'AND',
                      ['custrecord_lmry_br_currency', 'is', currency_mora], 'AND',
                      ['custrecord_lmry_br_interest', 'is', 'F'], 'AND',
                      ['isinactive', 'is', 'F']
                    ]
                  });
                  configPaySearch = configPaySearch.run().getRange(0, 1);
                  if (configPaySearch != null && configPaySearch != '') {
                    idAccount = configPaySearch[0].getValue('custrecord_lmry_br_bank_account');
                  }

                  var configPayMoraSearch = search.create({
                    type: 'customrecord_lmry_br_config_bank_payment',
                    columns: ['custrecord_lmry_br_bank_account'],
                    filters: [
                      ['custrecord_lmry_br_config', 'is', idConfig], 'AND',
                      ['custrecord_lmry_br_currency', 'is', currency_mora], 'AND',
                      ['custrecord_lmry_br_interest', 'is', 'T'], 'AND',
                      ['isinactive', 'is', 'F']
                    ]
                  });
                  configPayMoraSearch = configPayMoraSearch.run().getRange(0, 1);
                  if (configPayMoraSearch != null && configPayMoraSearch != '') {
                    idAccountMora = configPayMoraSearch[0].getValue('custrecord_lmry_br_bank_account');
                  } else {
                    idAccountMora = idAccount;
                  }

                }*/
        if (idAccount == null || idAccount == '' || idAccount == 0 ||
          idAccountMora == null || idAccountMora == '' || idAccountMora == 0) {
          context.write({
            key: massive_key,
            value: ['A', flag_mora]
          });
          return true;
        }

        //MORAS
        for (var i = 0; i < invoicesData.length; i++) {

          var invoice_mora = JSON.parse(invoicesData[i]);

          if (invoice_mora.interes != 0) {

            if (F_SUITETAX === true || F_SUITETAX === "T") {

              var record_mora = record.load({
                type: record.Type.INVOICE,
                id: invoice_mora.value
              });

              var entityTaxRegNum = record_mora.getValue('entitytaxregnum');
              var nexus = record_mora.getValue('nexus');
              var subsidiaryTaxRegNum = record_mora.getValue('subsidiarytaxregnum');

              var new_invoice = record.copy({
                type: record.Type.INVOICE,
                id: invoice_mora.value,
                isDynamic: false
              });

            } else {
              var new_invoice = record.copy({
                type: record.Type.INVOICE,
                id: invoice_mora.value,
                isDynamic: false
              });
            }

            var new_invoice_id = new_invoice.save({
              disableTriggers: true,
              ignoreMandatoryFields: true
            });

            var record_invoice = record.load({
              type: record.Type.INVOICE,
              id: new_invoice_id
            });
            record_invoice.setValue({
              fieldId: 'memo',
              value: 'Latam - Juros'
            });
            record_invoice.setValue({
              fieldId: 'trandate',
              value: fecha
            });
            record_invoice.setValue({
              fieldId: 'terms',
              value: ''
            });
            record_invoice.setValue({
              fieldId: 'custbody_lmry_informacion_adicional',
              value: ''
            });
            record_invoice.setValue({
              fieldId: 'createdfrom',
              value: ''
            });
            if (approvalFeature == true || approvalFeature == 'T') {
              record_invoice.setValue({
                fieldId: 'approvalstatus',
                value: 2
              });
            }

            var c_lineas = record_invoice.getLineCount({
              sublistId: 'item'
            });

            for (var j = c_lineas - 1; j > -1; j--) {
              record_invoice.removeLine({
                sublistId: 'item',
                line: j
              });
              // SuiteTax
              if (F_SUITETAX === true || F_SUITETAX === "T") {
                record_invoice.removeLine({
                  sublistId: 'taxdetails',
                  line: j
                });
              }
            }
            //Add Line
            record_invoice.setSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              line: 0,
              value: interestItem
            });
            record_invoice.setSublistValue({
              sublistId: 'item',
              fieldId: 'quantity',
              line: 0,
              value: '1'
            });
            record_invoice.setSublistValue({
              sublistId: 'item',
              fieldId: 'rate',
              line: 0,
              value: parseFloat(invoice_mora.interes)
            });
            if (F_SUITETAX === false || F_SUITETAX === "F") {
              record_invoice.setSublistValue({
                sublistId: 'item',
                fieldId: 'tax1amt',
                line: 0,
                value: 0
              });
            }

            // SuiteTax
            if (F_SUITETAX === true || F_SUITETAX === "T") {
              var taxRegOverride = record_invoice.getValue('taxregoverride');
              if (taxRegOverride === true || taxRegOverride === "T") {
                record_invoice.setValue({
                  fieldId: 'nexus',
                  value: nexus
                });
                record_invoice.setValue({
                  fieldId: 'subsidiarytaxregnum',
                  value: subsidiaryTaxRegNum
                });
                record_invoice.setValue({
                  fieldId: 'entitytaxregnum',
                  value: entityTaxRegNum
                });
              }
            }

            var id_mora = record_invoice.save({
              ignoreMandatoryFields: true,
              disableTriggers: true
            });

            //concatenado += id_mora + "|";
            log.error('[id_mora]', id_mora);
            array_moras.push(id_mora);
          }

          if (invoice_mora.discount != 0) {
            //flag_mora = true;
            log.error('Datos', invoice_mora.discount + ',' + invoice_mora.value);

            var record_creditmemo = record.transform({
              fromType: record.Type.INVOICE,
              fromId: parseInt(invoice_mora.value),
              toType: record.Type.CREDIT_MEMO /*, isDynamic: true*/
            });

            record_creditmemo.setValue({
              fieldId: 'memo',
              value: 'Latam - Discount'
            });
            record_creditmemo.setValue({
              fieldId: 'trandate',
              value: fecha
            });
            var cm_lineas = record_creditmemo.getLineCount({
              sublistId: 'item'
            });

            for (var j = cm_lineas - 1; j > -1; j--) {
              record_creditmemo.removeLine({
                sublistId: 'item',
                line: j
              });
            }
            //Add Line
            record_creditmemo.setSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              line: 0,
              value: discountItem
            });
            record_creditmemo.setSublistValue({
              sublistId: 'item',
              fieldId: 'quantity',
              line: 0,
              value: '1'
            });
            record_creditmemo.setSublistValue({
              sublistId: 'item',
              fieldId: 'rate',
              line: 0,
              value: parseFloat(invoice_mora.discount)
            });
            record_creditmemo.setSublistValue({
              sublistId: 'item',
              fieldId: 'tax1amt',
              line: 0,
              value: 0
            });

            //Apply Invoice
            var cm_apply = record_creditmemo.getLineCount({
              sublistId: 'apply'
            });

            for (var j = 0; j < cm_apply; j++) {
              var aplica = record_creditmemo.getSublistValue({
                sublistId: 'apply',
                fieldId: 'apply',
                line: j
              });
              if (aplica == 'T' || aplica == true) {
                record_creditmemo.setSublistValue({
                  sublistId: 'apply',
                  fieldId: 'amount',
                  line: j,
                  value: parseFloat(invoice_mora.discount)
                });
              }
            }

            record_creditmemo.save({
              ignoreMandatoryFields: true,
              disableTriggers: true
            });

          }
        }

        log.error('array_moras', array_moras);

          log.error('[idAccountMora]', idAccountMora);
          log.error('[idAccount]', idAccount);
        if (idAccountMora != idAccount) {
          if (array_moras.length > 0) {
            flag_mora = true;

            var pay_mora = record.transform({
              fromType: record.Type.INVOICE,
              fromId: array_moras[0],
              toType: record.Type.CUSTOMER_PAYMENT,
              isDynamic: true
            });
            pay_mora.setValue({
              fieldId: 'currency',
              value: currency_mora
            });
            pay_mora.setValue({
              fieldId: 'memo',
              value: 'Latam - Arquivo Retorno'
            });
            //HARDCODEO DEL ACCOUNT HASTA DEFINIR LA BANK DEPOSITADO O NO
            pay_mora.setValue({
              fieldId: 'account',
              value: idAccountMora
            });
            pay_mora.setValue({
              fieldId: 'trandate',
              value: fecha
            });

            if ((F_DEPARTMENTS == 'T' || F_DEPARTMENTS == true) && Number(department) > 0) {
              pay_mora.setValue({
                fieldId: 'department',
                value: department
              });
            }
            if ((F_CLASSES == 'T' || F_CLASSES == true) && Number(class_) > 0) {
              pay_mora.setValue({
                fieldId: 'class',
                value: class_
              });
            }
            if ((F_LOCATIONS == 'T' || F_LOCATIONS == true) && Number(location) > 0) {
              pay_mora.setValue({
                fieldId: 'location',
                value: location
              });
            }

            if (segmentJson.name.length) {
              for (var i = 0; i < segmentJson.name.length; i++) {
                if (pay_mora.getField(segmentJson.name[i]) && Number(segmentJson.value[i]) > 0) {
                  pay_mora.setValue(segmentJson.name[i], segmentJson.value[i]);
                }
              }
            }

            var c_moras = pay_mora.getLineCount({
              sublistId: 'apply'
            });

            //log.error('account y ar/account',pay_mora.getText({fieldId:'account'}) + "-" + pay_mora.getText({fieldId:'aracct'}));

            for (var i = 0; i < c_moras; i++) {
              pay_mora.selectLine({
                sublistId: 'apply',
                line: i
              });
              var inv = pay_mora.getCurrentSublistValue({
                sublistId: 'apply',
                fieldId: 'doc'
              });

              for (var j = 0; j < array_moras.length; j++) {
                if (inv == array_moras[j]) {
                  pay_mora.setCurrentSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    value: true
                  });
                }
              }
            }

            var id_payment = pay_mora.save({
              disableTriggers: true,
              ignoreMandatoryFields: true
            });
            log.error('ID Payment Mora', id_payment);

            concatenado += id_payment + "|";

          }
        }


        //PAGO DEL INVOICE PRINCIPAL
        var prueba = JSON.parse(invoicesData[0]);

        var custPayment = record.transform({
          fromType: record.Type.INVOICE,
          fromId: prueba.value,
          toType: record.Type.CUSTOMER_PAYMENT,
          isDynamic: true
        });

        custPayment.setValue({
          fieldId: 'currency',
          value: currency_mora
        });
        custPayment.setValue({
          fieldId: 'memo',
          value: 'Latam - Arquivo Retorno'
        });
        //HARDCODEO DEL ACCOUNT HASTA DEFINIR LA BANK DEPOSITADO O NO
        custPayment.setValue({
          fieldId: 'account',
          value: idAccount
        });
        custPayment.setValue({
          fieldId: 'trandate',
          value: fecha
        });
        if ((F_DEPARTMENTS == 'T' || F_DEPARTMENTS == true) && Number(department) > 0) {
          custPayment.setValue({
            fieldId: 'department',
            value: department
          });
        }
        if ((F_CLASSES == 'T' || F_CLASSES == true) && Number(class_) > 0) {
          custPayment.setValue({
            fieldId: 'class',
            value: class_
          });
        }
        if ((F_LOCATIONS == 'T' || F_LOCATIONS == true) && Number(location) > 0) {
          custPayment.setValue({
            fieldId: 'location',
            value: location
          });
        }

        if (segmentJson.name.length) {
          for (var i = 0; i < segmentJson.name.length; i++) {
            if (custPayment.getField(segmentJson.name[i]) && Number(segmentJson.value[i]) > 0) {
              custPayment.setValue(segmentJson.name[i], segmentJson.value[i]);
            }
          }
        }

        var c_invoices = custPayment.getLineCount({
          sublistId: 'apply'
        });

        for (var i = 0; i < c_invoices; i++) {
          custPayment.selectLine({
            sublistId: 'apply',
            line: i
          });
          var inv = custPayment.getCurrentSublistValue({
            sublistId: 'apply',
            fieldId: 'doc'
          });
          var installnum = '0';
          if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == "T") {
            installnum = custPayment.getCurrentSublistValue({
              sublistId: "apply",
              fieldId: "installmentnumber"
            });
            if (!installnum) {
              installnum = '0';
            }
          }

          // Moras en el pago del invoice origen
          if (idAccountMora == idAccount) {
            for (var j = 0; j < array_moras.length; j++) {
              if (inv == array_moras[j]) {
                custPayment.setCurrentSublistValue({
                  sublistId: 'apply',
                  fieldId: 'apply',
                  value: true
                });
              }
            }
          }

          // Invoice origen en el pago
          for (var j = 0; j < invoicesData.length; j++) {
            if (inv == (JSON.parse(invoicesData[j])).value) {
              if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == "T") {
                if (installnum == (JSON.parse(invoicesData[j])).installment) {
                  custPayment.setCurrentSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    value: true
                  });

                  var monto = parseFloat((JSON.parse(invoicesData[j])).amount);
                  var due = parseFloat(custPayment.getCurrentSublistValue({
                    sublistId: 'apply',
                    fieldId: 'due'
                  }));
                  var amountpaid = (monto > due) ? due : monto;
                  custPayment.setCurrentSublistValue({
                    sublistId: 'apply',
                    fieldId: 'amount',
                    value: amountpaid
                  });
                  array_pagos.push({
                    invoice: inv,
                    amount: amountpaid,
                    installment: installnum
                  });
                }
              } else {
                var monto = parseFloat((JSON.parse(invoicesData[j])).amount);
                var due = parseFloat(custPayment.getCurrentSublistValue({
                  sublistId: 'apply',
                  fieldId: 'due'
                }));
                var amountpaid = (monto > due) ? due : monto;
                custPayment.setCurrentSublistValue({
                  sublistId: 'apply',
                  fieldId: 'amount',
                  value: amountpaid
                });
                array_pagos.push({
                  invoice: inv,
                  amount: amountpaid,
                  installment: 0
                });
              }

            }

          }
        }

        var invoice_pay = custPayment.save({
          disableTriggers: true,
          ignoreMandatoryFields: true
        });

        //Obtencion del Setup Tax Subsidiary
        var JsonSetup = library_custpayment.getSetupTaxSubsidiary(subsidiary);
        //Creacion de Tac Result del Pago

        for (var j = 0; j < array_pagos.length; j++) {
          library_custpayment.createPaymentWhtTaxResults(array_pagos[j].invoice, array_pagos[j].installment, invoice_pay, array_pagos[j].amount, JsonSetup['reclassSubtypes']);
        }

        //Creacion de Journal de Reclasificacion
        library_custpayment.createReclassJournalEntry(invoice_pay, JsonSetup['reclassSubtypes'], JsonSetup['journalform']);


        concatenado += invoice_pay;

        log.error('ID Pago Principal', invoice_pay);
        log.error('[concatenado]', concatenado);
        context.write({
          key: concatenado,
          value: ['T', flag_mora]
        });

      } catch (err) {
        context.write({
          key: context.key,
          value: ['F', false]
        });
        log.error('[ reduce ]', err);
        library_email.sendemail('[ reduce ]' + err, LMRY_script);
      }



    }

    /**
     * If this entry point is used, the reduce function is invoked one time for
     * each key and list of values provided..
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation of the represents a restart.
     * @param {number} context.concurrency - The maximum concurrency number when running the map/reduce script.
     * @param {Date} context.datecreated - The time and day when the script began running.
     * @param {number} context.seconds - The total number of seconds that elapsed during the processing of the script.
     * @param {number} context.usage - TThe total number of usage units consumed during the processing of the script.
     * @param {number} context.yields - The total number of yields that occurred during the processing of the script.
     * @param {Object} context.inputSummary - Object that contains data about the input stage.
     * @param {Object} context.mapSummary - Object that contains data about the map stage.
     * @param {Object} context.reduceSummary - Object that contains data about the reduce stage.
     * @param {Iterator} context.ouput - This param contains a "iterator().each(parameters)" function
     *
     * @since 2016.1
     */
    function summarize(context) {

      try {

        var c = 0;
        var a = 0;
        var s_payments = '';

        context.output.iterator().each(function(key, value) {
          value = JSON.parse(value);

          s_payments += value[1] + "|" + key + ";";
          if (value[0] == 'F') {
            c++;
          }
          if (value[0] == 'A') {
            a++;
          }

          return true;
        });
        s_payments = s_payments.substring(0, s_payments.length - 1);

        if (c != 0) {
          record.submitFields({
            type: 'customrecord_lmry_br_log_return_file',
            id: logid,
            values: {
              custrecord_lmry_br_log_return_state: 'Ocurrio un error',
              custrecord_lmry_br_log_return_payment: s_payments
            }
          });
        } else if (a != 0) {
          record.submitFields({
            type: 'customrecord_lmry_br_log_return_file',
            id: logid,
            values: {
              custrecord_lmry_br_log_return_state: 'Configurar cuenta para la moneda',
              custrecord_lmry_br_log_return_payment: s_payments
            }
          });
        } else {
          record.submitFields({
            type: 'customrecord_lmry_br_log_return_file',
            id: logid,
            values: {
              custrecord_lmry_br_log_return_state: 'Finalizado',
              custrecord_lmry_br_log_return_payment: s_payments
            }
          });
        }

      } catch (err) {
        library_email.sendemail('[ summarize ]' + err, LMRY_script);
        log.error('[ summarize]', err);
      }

    }

    function getCustomSegments() {
      var customSegments = [];
      var FEAT_CUSTOMSEGMENTS = runtime.isFeatureInEffect({
        feature: "customsegments"
      });

      if (FEAT_CUSTOMSEGMENTS == true || FEAT_CUSTOMSEGMENTS == "T") {
        var searchCustomSegments = search.create({
          type: "customrecord_lmry_setup_cust_segm",
          filters: [
            ["isinactive", "is", "F"]
          ],
          columns: [
            "internalid", "name", "custrecord_lmry_setup_cust_segm"
          ]
        });

        var results = searchCustomSegments.run().getRange(0, 1000);

        if (results && results.length) {
          for (var i = 0; i < results.length; i++) {
            var customSegmentId = results[i].getValue("custrecord_lmry_setup_cust_segm");
            customSegmentId = customSegmentId.trim() || "";
            if (customSegmentId) {
              customSegments.push(customSegmentId);
            }
          }
        }
      }
      return customSegments;
    }

    return {
      getInputData: getInputData,
      map: map,
      reduce: reduce,
      summarize: summarize
    };

  });
