/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_Massive_WHT_Purchase_LBRY.js  				    ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Nov 09 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/record', 'N/log', 'N/url', 'N/format'],

  function (serverWidget, search, runtime, record, log, url, format) {

    //JSON GLOBALES: GET INPUT DATA
    var jsonLog = {};
    var jsonSetupTax = {};
    var jsonSetupGet = {};
    var jsonGrouped = {};
    var jsonWhtCode = {};
    var currentLog = '';

    //CONFIGURACIONES
    var installments = runtime.isFeatureInEffect({ feature: "INSTALLMENTS" });
    var userObj = runtime.getCurrentUser();
    var mandatoryDepartment = userObj.getPreference({ name: "DEPTMANDATORY" });
    var mandatoryClass = userObj.getPreference({ name: "CLASSMANDATORY" });
    var mandatoryLocation = userObj.getPreference({ name: "LOCMANDATORY" });

    function setLog(idLog, idUser) {

      record.submitFields({ type: 'customrecord_lmry_br_wht_purchase_log', id: idLog, values: { custrecord_lmry_br_wht_log_state: 'Procesando', custrecord_lmry_br_wht_log_employee: idUser }, options: { ignoreMandatoryFields: true, disableTriggers: true } });

      var searchLog = search.lookupFields({
        type: 'customrecord_lmry_br_wht_purchase_log', id: idLog,
        columns: ['custrecord_lmry_br_wht_log_subsi', 'custrecord_lmry_br_wht_log_date', 'custrecord_lmry_br_wht_log_vendor', 'custrecord_lmry_br_wht_log_currency', 'custrecord_lmry_br_wht_log_apacc', 'custrecord_lmry_br_wht_log_bank',
          'custrecord_lmry_br_wht_log_period', 'custrecord_lmry_br_wht_log_bills', 'custrecord_lmry_br_wht_log_memo', 'custrecord_lmry_br_wht_log_department', 'custrecord_lmry_br_wht_log_class', 'custrecord_lmry_br_wht_log_location',
          'custrecord_lmry_br_wht_log_pmethod', 'custrecord_lmry_br_wht_log_check', 'custrecord_lmry_br_wht_log_process', 'custrecord_lmry_br_wht_log_advance']
      });

      currentLog = idLog;
      jsonLog[currentLog] = {};

      jsonLog[currentLog]['subsidiary'] = searchLog.custrecord_lmry_br_wht_log_subsi[0].value;
      jsonLog[currentLog]['vendor'] = searchLog.custrecord_lmry_br_wht_log_vendor[0].value;
      jsonLog[currentLog]['currency'] = searchLog.custrecord_lmry_br_wht_log_currency[0].value;
      jsonLog[currentLog]['apacc'] = searchLog.custrecord_lmry_br_wht_log_apacc[0].value;
      jsonLog[currentLog]['bank'] = searchLog.custrecord_lmry_br_wht_log_bank[0].value;
      jsonLog[currentLog]['date'] = searchLog.custrecord_lmry_br_wht_log_date;
      jsonLog[currentLog]['payments'] = searchLog.custrecord_lmry_br_wht_log_bills;
      jsonLog[currentLog]['period'] = searchLog.custrecord_lmry_br_wht_log_period[0].value;
      jsonLog[currentLog]['memo'] = searchLog.custrecord_lmry_br_wht_log_memo;
      jsonLog[currentLog]['check'] = searchLog.custrecord_lmry_br_wht_log_check;
      jsonLog[currentLog]['pmethod'] = searchLog.custrecord_lmry_br_wht_log_pmethod;
      jsonLog[currentLog]['process'] = searchLog.custrecord_lmry_br_wht_log_process;
      jsonLog[currentLog]['advance'] = searchLog.custrecord_lmry_br_wht_log_advance;

      //SEGMENTACION
      jsonLog[currentLog]['department'] = '';
      jsonLog[currentLog]['class'] = '';
      jsonLog[currentLog]['location'] = '';

      if (searchLog['custrecord_lmry_br_wht_log_department'].length > 0) {
        jsonLog[currentLog]['department'] = searchLog['custrecord_lmry_br_wht_log_department'][0].value;
      }

      if (searchLog['custrecord_lmry_br_wht_log_class'].length > 0) {
        jsonLog[currentLog]['class'] = searchLog['custrecord_lmry_br_wht_log_class'][0].value;
      }

      if (searchLog['custrecord_lmry_br_wht_log_location'].length > 0) {
        jsonLog[currentLog]['location'] = searchLog['custrecord_lmry_br_wht_log_location'][0].value;
      }

      jsonLog[currentLog]['bills'] = {};
      jsonLog[currentLog]['newbills'] = {};
      jsonLog[currentLog]['percent'] = {};
      jsonLog[currentLog]['truepercent'] = {};
      jsonLog[currentLog]['multaeinteres'] = {};
      jsonLog[currentLog]['journal'] = {};
      jsonLog[currentLog]['primerpago'] = {};
      jsonLog[currentLog]['percentjournal'] = {};

      jsonLog[currentLog] = jsonConcat(jsonLog[currentLog], jsonSetupTax);

    }

    function creadoTransacciones(currentPayment, idLog) {
      var subsidiary = currentPayment.subsidiary;
      var accountingPeriod = currentPayment.period;
      var vendor = currentPayment.vendor;
      var fechaIngresada = currentPayment.date;
      fechaIngresada = format.parse({ value: fechaIngresada, type: format.Type.DATE });
      var currency = currentPayment.currency;
      var apacc = currentPayment.apacc;
      var bank = currentPayment.bank;
      var memo = currentPayment.memo;
      var bills = currentPayment.bills;
      var payments = currentPayment.payments;
      var primerBill = currentPayment.primerb;
      var c_department = currentPayment.department;
      var c_class = currentPayment.class;
      var c_location = currentPayment.location;
      var pmethod = currentPayment.pmethod;
      var check = currentPayment.check;
      var formPayment = currentPayment.formPayment;
      var formJournal = currentPayment.formJournal;
      var formBill = currentPayment.formBill;
      var whtSubtypes = currentPayment.whtSubtypes;
      var journal = currentPayment.journal;
      var percent = currentPayment.percent;
      var truepercent = currentPayment.truepercent;
      var multaeinteres = currentPayment.multaeinteres;
      var itemInteres = currentPayment.itemInteres;
      var itemMulta = currentPayment.itemMulta;
      var newBills = currentPayment.newbills;
      var documento = currentPayment.documentType;
      var taxCode = currentPayment.taxCode;
      var percentjournal = currentPayment.percentjournal;
      var process = currentPayment.process;
      var advance = currentPayment.advance;

      //Nuevo para bills multa e interes
      var multaBills = {};

      //CREADO DE BILLS DE MULTA E INTERES
      var idsMultaInteres = '';
      for (var i in multaeinteres) {
        for (var j in multaeinteres[i]) {

          var multa = multaeinteres[i][j][0];
          var interes = multaeinteres[i][j][1];

          var amountNewBill = 0;
          if (multa) {
            amountNewBill += parseFloat(multa);
          }
          if (interes) {
            amountNewBill += parseFloat(interes);
          }

          if (parseFloat(amountNewBill) > 0) {
            var obj_bill = record.copy({ type: 'vendorbill', id: i, isDynamic: false });

            if (formBill != '') {
              obj_bill.setValue({ fieldId: 'customform', value: formBill });
            }

            /*obj_bill.setValue({fieldId: 'entity',value: vendor});
            obj_bill.setValue({fieldId: 'subsidiary',value: subsidiary});
            obj_bill.setValue({fieldId: 'currency',value: currency});
            obj_bill.setValue({fieldId: 'apacct',value: apacc});*/

            cleanVendorBillFields(obj_bill);

            //CAMPOS DE CABECERA
            obj_bill.setValue({ fieldId: 'trandate', value: fechaIngresada });
            obj_bill.setValue({ fieldId: 'postingperiod', value: accountingPeriod });
            obj_bill.setValue({ fieldId: 'approvalstatus', value: '2' });
            obj_bill.setValue({ fieldId: 'custbody_lmry_reference_transaction', value: i });
            obj_bill.setValue({ fieldId: 'custbody_lmry_reference_transaction_id', value: i });

            if (installments) {
              obj_bill.setValue('terms', '');
            }

            if (documento) {
              obj_bill.setValue({ fieldId: 'custbody_lmry_document_type', value: documento });
            }

            //SEGMENTACION
            var bDepartment = obj_bill.getValue('department') ? obj_bill.getValue('department') : c_department;
            var bClass = obj_bill.getValue('class') ? obj_bill.getValue('class') : c_class;
            var bLocation = obj_bill.getValue('location') ? obj_bill.getValue('location') : c_location;

            //REMOVER LINEAS
            var totalItems = obj_bill.getLineCount({ sublistId: 'item' });
            for (var k = 0; k < totalItems; k++) {
              obj_bill.removeLine({ sublistId: 'item', line: totalItems - k - 1 });
            }

            var totalExpenses = obj_bill.getLineCount({ sublistId: 'expense' });
            for (var k = 0; k < totalExpenses; k++) {
              obj_bill.removeLine({ sublistId: 'expense', line: totalExpenses - k - 1 });
            }

            //ADICION DE LINEAS
            var c = 0, memoBill = 'Latam - ';
            if (multa && itemMulta) {
              obj_bill.insertLine({ sublistId: 'item', line: c });

              obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'item', line: c, value: itemMulta });
              obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: c, value: "1" });
              obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: c, value: multa });
              if (taxCode) {
                obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'taxcode', line: c, value: taxCode });
              }

              if (mandatoryDepartment && bDepartment) {
                obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'department', line: c, value: bDepartment });
              }

              if (mandatoryClass && bClass) {
                obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'class', line: c, value: bClass });
              }

              if (mandatoryLocation && bLocation) {
                obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'location', line: c, value: bLocation });
              }

              memoBill = 'Multa';
              c++;
            }

            if (interes && itemInteres) {
              obj_bill.insertLine({ sublistId: 'item', line: c });

              obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'item', line: c, value: itemInteres });
              obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: c, value: "1" });
              obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: c, value: interes });
              if (taxCode) {
                obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'taxcode', line: c, value: taxCode });
              }

              if (mandatoryDepartment && bDepartment) {
                obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'department', line: c, value: bDepartment });
              }

              if (mandatoryClass && bClass) {
                obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'class', line: c, value: bClass });
              }

              if (mandatoryLocation && bLocation) {
                obj_bill.setSublistValue({ sublistId: 'item', fieldId: 'location', line: c, value: bLocation });
              }

              (c > 0) ? memoBill += ' e Interes' : memoBill += 'Interes';
              c++;
            }

            obj_bill.setValue({ fieldId: 'memo', value: memoBill });

            if (c > 0) {
              var idNewBill = obj_bill.save({ ignoreMandatoryFields: true, disableTriggers: true });
              idsMultaInteres += idNewBill + "|";
              multaBills[idNewBill] = amountNewBill;
            }

          }
        }
      }

      log.error('multaBills', multaBills);

      //CREADO DE BILL PAYMENT
      var obj_payment = record.transform({ fromType: record.Type.VENDOR_BILL, fromId: primerBill, toType: record.Type.VENDOR_PAYMENT, isDynamic: true });

      if (formPayment != '') {
        obj_payment.setValue({ fieldId: 'customform', value: formPayment });
      }

      obj_payment.setValue({ fieldId: 'subsidiary', value: subsidiary });
      obj_payment.setValue({ fieldId: 'trandate', value: fechaIngresada });
      obj_payment.setValue({ fieldId: 'postingperiod', value: accountingPeriod });
      obj_payment.setValue({ fieldId: 'currency', value: currency });
      obj_payment.setValue({ fieldId: 'apacct', value: apacc });
      obj_payment.setValue({ fieldId: 'account', value: bank });

      if (memo != null && memo != '') {
        obj_payment.setValue({ fieldId: 'memo', value: memo });
      }

      if (c_department != null && c_department != '') {
        obj_payment.setValue({ fieldId: 'department', value: c_department });
      }

      if (c_class != null && c_class != '') {
        obj_payment.setValue({ fieldId: 'class', value: c_class });
      }

      if (c_location != null && c_location != '') {
        obj_payment.setValue({ fieldId: 'location', value: c_location });
      }

      obj_payment.setValue({ fieldId: 'custbody_lmry_paymentmethod', value: pmethod });

      if (check != null && check != '') {
        try {
          obj_payment.setValue({ fieldId: 'tranid', value: check });
        } catch (err) {
          log.error('Error tranid Payment', err);

          if (idsMultaInteres) {
            var deleteMultaInteres = idsMultaInteres.split('|');
            for (var i = 0; i < deleteMultaInteres.length - 1; i++) {
              record.delete({ type: 'vendorbill', id: deleteMultaInteres[i] });
            }
          }

          record.submitFields({ type: 'customrecord_lmry_br_wht_purchase_log', id: idLog, values: { custrecord_lmry_br_wht_log_state: 'Ocurrio un error' }, options: { ignoreMandatoryFields: true, disableTriggers: true } });
          return true;

        }

      }

      //PAGO DE BILLS
      var cant_pay = obj_payment.getLineCount({ sublistId: 'apply' });
      var line_pay = 0, idPayment = '';
      var banderaJournal = true;

      for (var i = 0; i < cant_pay; i++) {
        obj_payment.selectLine({ sublistId: 'apply', line: i });
        var docid = obj_payment.getCurrentSublistValue({ sublistId: 'apply', fieldId: 'doc' });

        //APLICACION DE BILLS NORMALES
        for (var j in newBills) {
          for (k in newBills[j]) {
            if (docid == j) {
              if (k == '0') {
                obj_payment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true });
                obj_payment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: newBills[j][k][2] });
                line_pay++;
              } else {
                var numberInstallment = obj_payment.getCurrentSublistValue({ sublistId: 'apply', fieldId: 'installmentnumber' });
                if (numberInstallment == k) {
                  obj_payment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true });
                  obj_payment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: newBills[j][k][2] });
                  line_pay++;
                }
              }

            }

          }
        }

        //APLICACION DE NOTA DE CREDITO: ANTICIPO
        if (advance && banderaJournal) {
          var auxAdvance = JSON.parse(advance);

          var amountJournal = obj_payment.getCurrentSublistValue({ sublistId: 'apply', fieldId: 'total' });

          for (var j in auxAdvance) {
            if (auxAdvance[j]['id'] == docid && parseFloat(auxAdvance[j]['amount']) == Math.abs(parseFloat(amountJournal))) {
              obj_payment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true });
              //obj_payment.setCurrentSublistValue({sublistId: 'apply',fieldId: 'amount',value: parseFloat(auxAdvance[j]['amount'])});
              banderaJournal = false;
            }
          }


        }

      }

      //ACCOUNTING BOOK: BILL PAYMENT
      var ids = '0', rates = '1';

      if (obj_payment.getLineCount({ sublistId: 'accountingbookdetail' }) > 0) {
        for (var i = 0; i < obj_payment.getLineCount({ sublistId: 'accountingbookdetail' }); i++) {
          obj_payment.selectLine({ sublistId: 'accountingbookdetail', line: i });
          var idBook = obj_payment.getCurrentSublistValue({ sublistId: 'accountingbookdetail', fieldId: 'bookid' });
          var rateBook = obj_payment.getCurrentSublistValue({ sublistId: 'accountingbookdetail', fieldId: 'exchangerate' });

          ids += '|' + idBook;
          rates += '|' + rateBook;
        }
      }

      ids += '&' + rates;

      //SAVE DEL PAGO
      if (line_pay > 0) {
        try {
          idPayment = obj_payment.save({ ignoreMandatoryFields: true, disableTriggers: false });
        } catch (err) {
          log.error('Error al generarse el pago', err);

          if (idsMultaInteres) {
            var deleteMultaInteres = idsMultaInteres.split('|');
            for (var i = 0; i < deleteMultaInteres.length - 1; i++) {
              record.delete({ type: 'vendorbill', id: deleteMultaInteres[i] });
            }
          }

          record.submitFields({ type: 'customrecord_lmry_br_wht_purchase_log', id: idLog, values: { custrecord_lmry_br_wht_log_state: 'Ocurrio un error' }, options: { ignoreMandatoryFields: true, disableTriggers: true } });
          return true;

        }

        log.error('idPayment', idPayment);

        //APLICACION DE LOS BILLS DE MULTA E INTERES AL PAGO
        if (idPayment) {
          var loadPayment = record.load({ type: 'vendorpayment', id: idPayment, isDynamic: true });
          var cant_pay = loadPayment.getLineCount({ sublistId: 'apply' });

          for (var i = 0; i < cant_pay; i++) {
            loadPayment.selectLine({ sublistId: 'apply', line: i });
            var docid = loadPayment.getCurrentSublistValue({ sublistId: 'apply', fieldId: 'doc' });

            for (var j in multaBills) {
              if (j == docid) {
                var paymentTotal = loadPayment.getCurrentSublistValue({ sublistId: 'apply', fieldId: 'total' });
                loadPayment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true });
                loadPayment.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: paymentTotal });
              }
            }

          }

          loadPayment.setValue('custbody_lmry_br_amount_advance', '1');

          loadPayment.save({ ignoreMandatoryFields: true, disableTriggers: false });

        }

        //ACTUALIZACION LOG
        if (idPayment) {
          record.submitFields({
            type: 'customrecord_lmry_br_wht_purchase_log', id: idLog, values: {
              custrecord_lmry_br_wht_log_state: 'El pago ha sido generado, se estan generando las retenciones en caso hubiera, espere el estado FINALIZADO',
              custrecord_lmry_br_wht_log_payment: idPayment, custrecord_lmry_br_wht_log_id_payment: idPayment
            }, options: { ignoreMandatoryFields: true, disableTriggers: true }
          });

          //ACTUALIZACION DE MULTA E INTERES EN EL BR TRANSACTION FIELD
          var idBrTransaction = '';
          for (var i in bills) {
            var multa = 0, interes = 0;
            for (var k in multaeinteres[i]) {
              if (multaeinteres[i][k][0]) {
                multa += parseFloat(multaeinteres[i][k][0]);
              }

              if (multaeinteres[i][k][1]) {
                interes += parseFloat(multaeinteres[i][k][1]);
              }

            }

            idBrTransaction += multa + ";" + interes + ";";

            var searchBR = search.create({ type: 'customrecord_lmry_br_transaction_fields', columns: ['internalid', 'custrecord_lmry_br_multa', 'custrecord_lmry_br_interes'], filters: [{ name: 'custrecord_lmry_br_related_transaction', operator: 'anyof', values: i }] });
            var resultBR = searchBR.run().getRange({ start: 0, end: 1 });

            //BR EXISTE
            if (resultBR != null && resultBR.length > 0) {
              var multaBR = resultBR[0].getValue('custrecord_lmry_br_multa');
              var interesBR = resultBR[0].getValue('custrecord_lmry_br_interes');

              if (multaBR) {
                multa += parseFloat(multaBR);
              }

              if (interesBR) {
                interes += parseFloat(interesBR);
              }

              idBrTransaction += resultBR[0].getValue('internalid') + "|";

              record.submitFields({ type: 'customrecord_lmry_br_transaction_fields', id: resultBR[0].getValue('internalid'), values: { custrecord_lmry_br_multa: multa, custrecord_lmry_br_interes: interes }, options: { ignoreMandatoryFields: true, disableTriggers: true } });
            } else {
              //BR NO EXISTE
              var newBR = record.create({ type: 'customrecord_lmry_br_transaction_fields' });
              newBR.setValue('custrecord_lmry_br_related_transaction', i);
              newBR.setValue('custrecord_lmry_br_multa', multa);
              newBR.setValue('custrecord_lmry_br_interes', interes);

              var idBR = newBR.save({ ignoreMandatoryFields: true, disableTriggers: true });
              idBrTransaction += idBR + "|";

            }
          }

          record.submitFields({ type: 'customrecord_lmry_br_wht_purchase_log', id: idLog, values: { custrecord_lmry_br_wht_log_ids: idsMultaInteres, custrecord_lmry_br_wht_log_id_br: idBrTransaction }, options: { ignoreMandatoryFields: true, disableTriggers: true } });

        }
      }




      //COPY TAX RESULT
      for (var i in bills) {
        //BILL NO TIENE TAX RESULT
        if (bills[i].length == 0) {
          continue;
        }

        for (var j = 0; j < bills[i].length; j++) {
          var copyTaxResult = record.copy({ type: 'customrecord_lmry_br_transaction', id: bills[i][j], isDynamic: true });

          var truePercentBill = 0;
          for (var k in percentjournal[i]) {
            truePercentBill += parseFloat(percentjournal[i][k]);
          }

          var base_amount = copyTaxResult.getValue('custrecord_lmry_base_amount');

          if (parseFloat(base_amount) >= 0) {
            base_amount = parseFloat(base_amount) * parseFloat(truePercentBill);
            base_amount = Math.round(parseFloat(base_amount) * 10000) / 10000;
            copyTaxResult.setValue('custrecord_lmry_base_amount', base_amount);
          }

          var total = copyTaxResult.getValue('custrecord_lmry_br_total');
          if (parseFloat(total) >= 0) {
            total = parseFloat(total) * parseFloat(truePercentBill);
            total = Math.round(parseFloat(total) * 10000) / 10000;
            copyTaxResult.setValue('custrecord_lmry_br_total', total);
          }

          var total_base = copyTaxResult.getValue('custrecord_lmry_total_base_currency');
          if (parseFloat(total_base) >= 0) {
            total_base = parseFloat(total_base) * parseFloat(truePercentBill);
            total_base = Math.round(parseFloat(total_base) * 10000) / 10000;
            copyTaxResult.setValue('custrecord_lmry_total_base_currency', total_base);
          }

          //NUEVOS CAMPOS: TAB LOCAL CURRENCY
          var baseLocal = copyTaxResult.getValue('custrecord_lmry_base_amount_local_currc');
          if (parseFloat(baseLocal) >= 0) {
            baseLocal = parseFloat(baseLocal) * parseFloat(truePercentBill);
            baseLocal = Math.round(parseFloat(baseLocal) * 10000) / 10000;
            copyTaxResult.setValue('custrecord_lmry_base_amount_local_currc', baseLocal);
          }

          var amountLocal = copyTaxResult.getValue('custrecord_lmry_amount_local_currency');
          if (parseFloat(amountLocal) >= 0) {
            amountLocal = parseFloat(amountLocal) * parseFloat(truePercentBill);
            amountLocal = Math.round(parseFloat(amountLocal) * 10000) / 10000;
            copyTaxResult.setValue('custrecord_lmry_amount_local_currency', amountLocal);
          }

          copyTaxResult.setValue('custrecord_lmry_br_transaction', idPayment);
          copyTaxResult.setValue('custrecord_lmry_br_related_id', parseFloat(idPayment) + "");
          copyTaxResult.setValue('custrecord_lmry_related_applied_transact', i);
          copyTaxResult.setValue('custrecord_lmry_accounting_books', ids);

          var idTaxResult = copyTaxResult.save({ ignoreMandatoryFields: true, disableTriggers: true });
          //log.error('idTaxResult',idTaxResult);

        }
      }

      createImportTaxResults(bills, percentjournal, idPayment, ids);

      //CREACION JOURNAL
      var searchAccount = search.create({
        type: 'customrecord_lmry_br_wht_purchase_acc', columns: ['custrecord_lmry_br_wht_purchase_subtype', 'custrecord_lmry_br_wht_purchase_debit', 'custrecord_lmry_br_wht_purchase_credit'],
        filters: [{ name: 'custrecord_lmry_br_wht_purchase_subsi', operator: 'anyof', values: subsidiary }, { name: 'isinactive', operator: 'is', values: 'F' }]
      });

      var resultAccount = searchAccount.run().getRange({ start: 0, end: 1000 });

      var jsonAccount = {};
      if (resultAccount != null && resultAccount.length > 0) {
        for (var i = 0; i < resultAccount.length; i++) {
          var subtype = resultAccount[i].getValue('custrecord_lmry_br_wht_purchase_subtype');
          var debitAccount = resultAccount[i].getValue('custrecord_lmry_br_wht_purchase_debit');
          var creditAccount = resultAccount[i].getValue('custrecord_lmry_br_wht_purchase_credit');

          jsonAccount[subtype + ";" + debitAccount] = creditAccount;

        }
      }

      var journalAc = record.create({ type: 'journalentry', isDynamic: true });

      if (formJournal != '') {
        journalAc.setValue({ fieldId: 'customform', value: formJournal });
      }

      journalAc.setValue('subsidiary', subsidiary);
      journalAc.setValue('currency', currency);
      journalAc.setValue('trandate', fechaIngresada);
      journalAc.setValue('postingperiod', accountingPeriod);
      journalAc.setValue('memo', 'LatamReady - BR WHT Purchase');
      journalAc.setValue('approvalstatus', '2');

      journalAc.setValue('custbody_lmry_reference_transaction', idPayment);
      journalAc.setValue('custbody_lmry_reference_transaction_id', idPayment);

      var contadorJournal = 0;
      for (var i in journal) {
        var numeroBill = i;

        var truePercentBill = 0;
        for (var k in percentjournal[numeroBill]) {
          truePercentBill += parseFloat(percentjournal[numeroBill][k]);
        }

        for (var j in journal[i]) {
          var monto = journal[i][j]['amount'];
          monto = Math.abs(parseFloat(monto)) * parseFloat(truePercentBill);
          monto = Math.round(parseFloat(monto) * 100) / 100;

          var debitAccount = journal[i][j]['account'];
          var impuesto = journal[i][j]['impuesto'];

          if (parseFloat(monto) <= 0) {
            continue;
          }

          if (jsonAccount[impuesto + ";" + debitAccount] != null && jsonAccount[impuesto + ";" + debitAccount] != undefined) {
            journalAc.selectNewLine({ sublistId: 'line' });
            journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: debitAccount });
            journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: monto });
            journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_lmry_pe_transaction_reference', value: numeroBill });

            if (journal[i][j]['department'] != null && journal[i][j]['department'] != '') {
              journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'department', value: journal[i][j]['department'] });
            }

            if (journal[i][j]['class'] != null && journal[i][j]['class'] != '') {
              journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'class', value: journal[i][j]['class'] });
            }

            if (journal[i][j]['location'] != null && journal[i][j]['location'] != '') {
              journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'location', value: journal[i][j]['location'] });
            }

            journalAc.commitLine({ sublistId: 'line' });

            journalAc.selectNewLine({ sublistId: 'line' });
            journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: jsonAccount[impuesto + ";" + debitAccount] });
            journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: monto });
            journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_lmry_pe_transaction_reference', value: numeroBill });

            if (journal[i][j]['department'] != null && journal[i][j]['department'] != '') {
              journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'department', value: journal[i][j]['department'] });
            }

            if (journal[i][j]['class'] != null && journal[i][j]['class'] != '') {
              journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'class', value: journal[i][j]['class'] });
            }

            if (journal[i][j]['location'] != null && journal[i][j]['location'] != '') {
              journalAc.setCurrentSublistValue({ sublistId: 'line', fieldId: 'location', value: journal[i][j]['location'] });
            }

            journalAc.commitLine({ sublistId: 'line' });

            contadorJournal++;
          }
        }

      }

      var idJournal = '';
      if (contadorJournal > 0) {
        idJournal = journalAc.save({ ignoreMandatoryFields: true, disableTriggers: true });
      }

      log.error('idJournal', idJournal);

      if (idJournal) {
        record.submitFields({ type: 'customrecord_lmry_br_wht_purchase_log', id: idLog, values: { custrecord_lmry_br_wht_log_journal: idJournal, custrecord_lmry_br_wht_log_state: 'Finalizado' }, options: { ignoreMandatoryFields: true, disableTriggers: true } });
      } else {
        record.submitFields({ type: 'customrecord_lmry_br_wht_purchase_log', id: idLog, values: { custrecord_lmry_br_wht_log_state: 'Finalizado' }, options: { ignoreMandatoryFields: true, disableTriggers: true } });
      }

    }

    function whtStandard(subsidiary) {

      //BUSQUEDA DE BR GET WHT
      var filtroSetup = [];
      filtroSetup[0] = search.createFilter({ name: 'custrecord_lmry_br_get_subsidiary', operator: 'is', values: subsidiary });
      filtroSetup[1] = search.createFilter({ name: 'custrecord_lmry_br_get_wht_tax_code', operator: 'isnotempty', values: "" });
      filtroSetup[2] = search.createFilter({ name: 'custrecord_lmry_br_get_tax_code', operator: 'isnotempty', values: "" });
      filtroSetup[3] = search.createFilter({ name: 'custrecord_lmry_br_get_percent', operator: 'isnotempty', values: "" });
      filtroSetup[4] = search.createFilter({ name: 'custrecord_lmry_br_get_item_purchase', operator: 'noneof', values: "@NONE@" });
      filtroSetup[5] = search.createFilter({ name: 'custrecord_lmry_br_get_account_purchase', operator: 'noneof', values: "@NONE@" });
      filtroSetup[6] = search.createFilter({ name: 'isinactive', operator: 'is', values: "F" });
      filtroSetup[7] = search.createFilter({ name: 'custrecord_lmry_br_get_journal', operator: 'is', values: 'T' });
      filtroSetup[8] = search.createFilter({ name: 'custrecord_lmry_br_get_gwht_tax_code', operator: 'isempty', values: "" });

      var searchSetup = search.create({ type: 'customrecord_lmry_br_get_wht_ns', columns: ['internalid', 'custrecord_lmry_br_get_percent', 'custrecord_lmry_br_get_item_purchase', 'custrecord_lmry_br_get_account_purchase', 'custrecord_lmry_br_get_tax_code', 'custrecord_lmry_br_get_wht_tax_code'], filters: filtroSetup });
      var resultSetup = searchSetup.run().getRange({ start: 0, end: 1000 });

      if (resultSetup != null && resultSetup.length > 0) {
        for (var i = 0; i < resultSetup.length; i++) {
          var impuesto = resultSetup[i].getValue('custrecord_lmry_br_get_tax_code');
          var bandera = false;

          if (jsonSetupTax['subtypes']) {
            var auxSubtypes = jsonSetupTax['subtypes'].split(',');
            for (var j = 0; j < auxSubtypes.length; j++) {
              if (impuesto == auxSubtypes[j]) {
                bandera = true;
                break;
              }
            }
          }

          if (!bandera) {
            continue;
          }

          var whtCode = resultSetup[i].getValue('custrecord_lmry_br_get_wht_tax_code');
          var whtPercent = resultSetup[i].getValue('custrecord_lmry_br_get_percent');
          var item = resultSetup[i].getValue('custrecord_lmry_br_get_item_purchase');
          var account = resultSetup[i].getValue('custrecord_lmry_br_get_account_purchase');


          if (jsonSetupGet[whtCode + ";" + item + ";" + whtPercent + ";" + account] == null || jsonSetupGet[whtCode + ";" + item + ";" + whtPercent + ";" + account] == undefined) {
            jsonSetupGet[whtCode + ";" + item + ";" + whtPercent + ";" + account] = impuesto;
          }

        }
      }

      //log.error('jsonSetupGet',jsonSetupGet);

      //BUSQUEDA DE Grouped Withholding Tax Code
      var searchGrouped = search.create({
        type: 'customrecord_4601_groupedwitaxcode', columns: ['custrecord_4601_gwtc_group', 'custrecord_4601_gwtc_code', 'internalid'], filters:
          [
            ["custrecord_4601_gwtc_group.custrecord_4601_wtc_istaxgroup", "is", "T"], "AND",
            ["custrecord_4601_gwtc_code.custrecord_4601_wtc_istaxgroup", "is", "F"], "AND",
            ["custrecord_4601_gwtc_code.custrecord_4601_wtc_subsidiaries", "anyof", subsidiary], "AND",
            ["custrecord_4601_gwtc_group.custrecord_4601_wtc_subsidiaries", "anyof", subsidiary]
          ]
      });

      var resultGrouped = searchGrouped.run().getRange({ start: 0, end: 1000 });

      if (resultGrouped != null && resultGrouped.length > 0) {
        for (var i = 0; i < resultGrouped.length; i++) {
          if (jsonGrouped[resultGrouped[i].getValue('custrecord_4601_gwtc_group')] == null || jsonGrouped[resultGrouped[i].getValue('custrecord_4601_gwtc_group')] == undefined) {
            jsonGrouped[resultGrouped[i].getValue('custrecord_4601_gwtc_group')] = [];
          }
          jsonGrouped[resultGrouped[i].getValue('custrecord_4601_gwtc_group')].push(resultGrouped[i].getValue('custrecord_4601_gwtc_code'));
        }
      }

      //log.error('jsonGrouped',jsonGrouped);

      //WHT CODE INDIVIDUAL
      var searchWhtCode = search.create({
        type: 'customrecord_4601_witaxcode', columns: ['custrecord_4601_wtc_rate', search.createColumn({ name: 'custrecord_4601_wtt_purcitem', join: 'CUSTRECORD_4601_WTC_WITAXTYPE' }), search.createColumn({ name: 'custrecord_4601_wtt_purcaccount', join: 'CUSTRECORD_4601_WTC_WITAXTYPE' }), 'internalid'],
        filters: [{ name: 'custrecord_4601_wtc_istaxgroup', operator: 'is', values: 'F' }, { name: 'custrecord_4601_wtc_subsidiaries', operator: 'anyof', values: subsidiary }]
      });

      var resultWhtCode = searchWhtCode.run().getRange({ start: 0, end: 1000 });

      if (resultWhtCode != null && resultWhtCode.length > 0) {
        var columnsWHTCode = resultWhtCode[0].columns;
        for (var i = 0; i < resultWhtCode.length; i++) {
          jsonWhtCode[resultWhtCode[i].getValue('internalid')] = { 'rate': resultWhtCode[i].getValue(columnsWHTCode[0]), 'item': resultWhtCode[i].getValue(columnsWHTCode[1]), 'account': resultWhtCode[i].getValue(columnsWHTCode[2]) };
        }
      }

      //log.error('jsonWhtCode',jsonWhtCode);

    }

    function iteracionBill() {

      var bills = [], billsAux = [];
      var payments = jsonLog[currentLog]['payments'].split('|');

      for (var i = 0; i < payments.length - 1; i++) {
        var auxBill = payments[i].split(';');

        var numeroInstallment = auxBill[5];

        if (jsonLog[currentLog]['multaeinteres'][auxBill[0]] == null || jsonLog[currentLog]['multaeinteres'][auxBill[0]] == undefined) {
          jsonLog[currentLog]['multaeinteres'][auxBill[0]] = {};
          jsonLog[currentLog]['truepercent'][auxBill[0]] = {};
          jsonLog[currentLog]['percent'][auxBill[0]] = {};
          jsonLog[currentLog]['newbills'][auxBill[0]] = {};
          //jsonLog[currentLog]['advance'][auxBill[0]] = {};
          jsonLog[currentLog]['primerpago'][auxBill[0]] = {};
          jsonLog[currentLog]['percentjournal'][auxBill[0]] = {};
          //jsonLog[currentLog]['bills'][auxBill[0]] = [0,0,0,0];

          bills.push(auxBill[0]);
          billsAux.push(auxBill[0]);

        }

        jsonLog[currentLog]['bills'][auxBill[0]] = [];

        jsonLog[currentLog]['primerpago'][auxBill[0]][numeroInstallment] = auxBill[9];
        jsonLog[currentLog]['multaeinteres'][auxBill[0]][numeroInstallment] = [auxBill[6], auxBill[7]];
        jsonLog[currentLog]['truepercent'][auxBill[0]][numeroInstallment] = parseFloat(auxBill[3]) / parseFloat(auxBill[4]);
        jsonLog[currentLog]['percent'][auxBill[0]][numeroInstallment] = parseFloat(auxBill[3]) / parseFloat(auxBill[1]);

        if (auxBill[9] == 'T' && jsonLog[currentLog]['process'] == 'Individual' && parseFloat(auxBill[8]) > 0) {
          auxBill[3] = parseFloat(auxBill[3]) + parseFloat(auxBill[8]);
        }

        jsonLog[currentLog]['newbills'][auxBill[0]][numeroInstallment] = [auxBill[1], auxBill[2], auxBill[3], auxBill[5]];
        jsonLog[currentLog]['percentjournal'][auxBill[0]][numeroInstallment] = parseFloat(auxBill[3]) / parseFloat(auxBill[4]);

      }

      jsonLog[currentLog]['primerb'] = bills[0];

      for (var i = 0; i < bills.length; i++) {
        var loadBill = record.load({ type: 'vendorbill', id: bills[i] });

        var jsonItems = {}, jsonItemsWHT = {}, cItemsWHT = 0, cExpensesWHT = 0, jsonExpenses = {}, jsonExpensesWHT = {};

        for (var j = 0; j < loadBill.getLineCount('item'); j++) {
          //PARA LOS ITEMS QUE TIENEN RETENCION WHT
          var witaxapplies = loadBill.getSublistValue('item', 'custcol_4601_witaxapplies', j);

          if (witaxapplies == true || witaxapplies == 'T') {
            var witaxamount = loadBill.getSublistValue('item', 'custcol_4601_witaxamount', j);
            var witaxbase = loadBill.getSublistValue('item', 'custcol_4601_witaxbaseamount', j);
            var witaxrate = loadBill.getSublistValue('item', 'custcol_4601_witaxrate', j);
            var witaxcode = loadBill.getSublistValue('item', 'custcol_4601_witaxcode', j);

            //SI ES GRUPAL
            if (jsonGrouped[witaxcode] != null && jsonGrouped[witaxcode] != undefined) {
              for (var k = 0; k < jsonGrouped[witaxcode].length; k++) {
                if (jsonItems[jsonGrouped[witaxcode][k] + ";I"] == null || jsonItems[jsonGrouped[witaxcode][k] + ";I"] == undefined) {
                  jsonItems[jsonGrouped[witaxcode][k] + ";I"] = { 'amount': 0, 'item': jsonWhtCode[jsonGrouped[witaxcode][k]]['item'], 'rate': jsonWhtCode[jsonGrouped[witaxcode][k]]['rate'], 'account': jsonWhtCode[jsonGrouped[witaxcode][k]]['account'] };
                }

                var individualAmount = parseFloat(jsonWhtCode[jsonGrouped[witaxcode][k]]['rate']) * parseFloat(witaxbase) / -100;
                jsonItems[jsonGrouped[witaxcode][k] + ";I"]['amount'] = parseFloat(jsonItems[jsonGrouped[witaxcode][k] + ";I"]['amount']) + parseFloat(individualAmount);

              }
            }

            //SI ES INDIVIDUAL
            if (jsonWhtCode[witaxcode] != null && jsonWhtCode[witaxcode] != undefined) {
              if (jsonItems[witaxcode + ";I"] == null || jsonItems[witaxcode + ";I"] == undefined) {
                jsonItems[witaxcode + ";I"] = { 'amount': 0, 'item': jsonWhtCode[witaxcode]['item'], 'rate': jsonWhtCode[witaxcode]['rate'], 'account': jsonWhtCode[witaxcode]['account'] };
              }

              jsonItems[witaxcode + ";I"]['amount'] = parseFloat(jsonItems[witaxcode + ";I"]['amount']) + parseFloat(witaxamount);

            }
          }

          //PARA LOS ITEMS WHT

          var witaxline = loadBill.getSublistValue('item', 'custcol_4601_witaxline', j);

          if (witaxline == 'T' || witaxline == true) {
            var amount = loadBill.getSublistValue('item', 'amount', j);
            var idItem = loadBill.getSublistValue('item', 'item', j);
            var sDepartment = loadBill.getSublistValue('item', 'department', j);
            var sClass = loadBill.getSublistValue('item', 'class', j);
            var sLocation = loadBill.getSublistValue('item', 'location', j);

            jsonItemsWHT[idItem + ";" + amount] = { 'department': sDepartment, 'class': sClass, 'location': sLocation };
            cItemsWHT += parseFloat(amount);

          }

        }//ITERACION DE ITEM

        //EXPENSES
        for (var j = 0; j < loadBill.getLineCount('expense'); j++) {
          //PARA LOS EXPENSES QUE TIENEN RETENCION WHT
          var witaxapplies = loadBill.getSublistValue('expense', 'custcol_4601_witaxapplies', j);

          if (witaxapplies == true || witaxapplies == 'T') {
            /*UN SANDBOX NO TENIA ESTE CAMPO SOLO EL _exp
            var witaxamount = loadBill.getSublistValue('expense','custcol_4601_witaxamount',j);
            var witaxcode = loadBill.getSublistValue('expense','custcol_4601_witaxcode',j);
            var witaxrate = loadBill.getSublistValue('expense','custcol_4601_witaxrate',j);
            var witaxbase = loadBill.getSublistValue('expense','custcol_4601_witaxbaseamount',j);*/
            var witaxamount = loadBill.getSublistValue('expense', 'custcol_4601_witaxamt_exp', j);
            var witaxbase = loadBill.getSublistValue('expense', 'custcol_4601_witaxbamt_exp', j);
            var witaxrate = loadBill.getSublistValue('expense', 'custcol_4601_witaxrate_exp', j);
            var witaxcode = loadBill.getSublistValue('expense', 'custcol_4601_witaxcode_exp', j);

            //SI ES GRUPAL
            if (jsonGrouped[witaxcode] != null && jsonGrouped[witaxcode] != undefined) {
              for (var k = 0; k < jsonGrouped[witaxcode].length; k++) {
                if (jsonExpenses[jsonGrouped[witaxcode][k] + ";E"] == null || jsonExpenses[jsonGrouped[witaxcode][k] + ";E"] == undefined) {
                  jsonExpenses[jsonGrouped[witaxcode][k] + ";E"] = { 'amount': 0, 'item': jsonWhtCode[jsonGrouped[witaxcode][k]]['item'], 'rate': jsonWhtCode[jsonGrouped[witaxcode][k]]['rate'], 'account': jsonWhtCode[jsonGrouped[witaxcode][k]]['account'] };
                }

                var individualAmount = parseFloat(jsonWhtCode[jsonGrouped[witaxcode][k]]['rate']) * parseFloat(witaxbase) / -100;
                jsonExpenses[jsonGrouped[witaxcode][k] + ";E"]['amount'] = parseFloat(jsonExpenses[jsonGrouped[witaxcode][k] + ";E"]['amount']) + parseFloat(individualAmount);
              }
            }

            //SI ES INDIVIDUAL
            if (jsonWhtCode[witaxcode] != null && jsonWhtCode[witaxcode] != undefined) {
              if (jsonExpenses[witaxcode + ";E"] == null || jsonExpenses[witaxcode + ";E"] == undefined) {
                jsonExpenses[witaxcode + ";E"] = { 'amount': 0, 'item': jsonWhtCode[witaxcode]['item'], 'rate': jsonWhtCode[witaxcode]['rate'], 'account': jsonWhtCode[witaxcode]['account'] };
              }

              jsonExpenses[witaxcode + ";E"]['amount'] = parseFloat(jsonExpenses[witaxcode + ";E"]['amount']) + parseFloat(witaxamount);

            }
          }

          //PARA LOS EXPENSES WHT
          //var witaxline = loadBill.getSublistValue('expense','custcol_4601_witaxline',j);
          var witaxline = loadBill.getSublistValue('expense', 'custcol_4601_witaxline_exp', j);

          if (witaxline == 'T' || witaxline == true) {
            var amount = loadBill.getSublistValue('expense', 'amount', j);
            var idAccount = loadBill.getSublistValue('expense', 'account', j);
            var sDepartment = loadBill.getSublistValue('expense', 'department', j);
            var sClass = loadBill.getSublistValue('expense', 'class', j);
            var sLocation = loadBill.getSublistValue('expense', 'location', j);

            jsonExpensesWHT[idAccount + ";" + amount] = { 'department': sDepartment, 'class': sClass, 'location': sLocation };
            cExpensesWHT += parseFloat(amount);

          }

        }

        var cItemAmount = 0, cExpenseAmount = 0;
        for (var j in jsonItems) {
          cItemAmount += Math.round(parseFloat(jsonItems[j]['amount']) * 100) / 100;
        }

        for (var j in jsonExpenses) {
          cExpenseAmount += Math.round(parseFloat(jsonExpenses[j]['amount']) * 100) / 100;
        }

        if (Math.abs(parseFloat(cItemAmount) - parseFloat(cItemsWHT)) > 0.5 || Math.abs(parseFloat(cExpenseAmount) - parseFloat(cExpensesWHT)) > 0.5) {
          billsAux = eliminarArray(billsAux, bills[i]);
          continue;
        }

        //MATCH ITEMS
        for (var j in jsonItems) {
          var item = jsonItems[j]['item'];
          var percent = jsonItems[j]['rate'];
          var amount = jsonItems[j]['amount'];
          var account = jsonItems[j]['account'];
          var wtaxcode = j.split(';')[0];

          //REDONDEO DE AMOUNTS PARA EL MATCH CON LA SEGMENTACION
          amount = Math.round(parseFloat(amount) * 100) / 100;
          jsonItems[j]['amount'] = amount;

          //SETUP
          if (jsonSetupGet[wtaxcode + ";" + item + ";" + percent + ";" + account] != null && jsonSetupGet[wtaxcode + ";" + item + ";" + percent + ";" + account] != undefined) {
            jsonItems[j]['impuesto'] = jsonSetupGet[wtaxcode + ";" + item + ";" + percent + ";" + account];
          }

          //ITEMS WHT
          if (jsonItemsWHT[item + ";" + amount] != null && jsonItemsWHT[item + ";" + amount] != undefined) {
            jsonItems[j]['department'] = jsonItemsWHT[item + ";" + amount]['department'];
            jsonItems[j]['class'] = jsonItemsWHT[item + ";" + amount]['class'];
            jsonItems[j]['location'] = jsonItemsWHT[item + ";" + amount]['location'];
          }
        }

        //MATCH EXPENSES
        for (var j in jsonExpenses) {
          var item = jsonExpenses[j]['item'];
          var percent = jsonExpenses[j]['rate'];
          var amount = jsonExpenses[j]['amount'];
          var account = jsonExpenses[j]['account'];
          var wtaxcode = j.split(';')[0];

          //REDONDEO DE AMOUNTS PARA EL MATCH CON LA SEGMENTACION
          amount = Math.round(parseFloat(amount) * 100) / 100;
          jsonExpenses[j]['amount'] = amount;

          //SETUP
          if (jsonSetupGet[wtaxcode + ";" + item + ";" + percent + ";" + account] != null && jsonSetupGet[wtaxcode + ";" + item + ";" + percent + ";" + account] != undefined) {
            jsonExpenses[j]['impuesto'] = jsonSetupGet[wtaxcode + ";" + item + ";" + percent + ";" + account];
          }

          //EXPENSES wht
          if (jsonExpensesWHT[account + ";" + amount] != null && jsonExpensesWHT[account + ";" + amount] != undefined) {
            jsonExpenses[j]['department'] = jsonExpensesWHT[account + ";" + amount]['department'];
            jsonExpenses[j]['class'] = jsonExpensesWHT[account + ";" + amount]['class'];
            jsonExpenses[j]['location'] = jsonExpensesWHT[account + ";" + amount]['location'];
          }
        }

        var jsonFinal = {};

        for (var l in jsonItems) {
          jsonFinal[l] = jsonItems[l];
        }

        for (var l in jsonExpenses) {
          jsonFinal[l] = jsonExpenses[l];
        }

        jsonLog[currentLog]['journal'][bills[i]] = jsonFinal;

      }

      //COPY TAX RESULT
      if (billsAux.length > 0) {
        var filtrosTR = [];
        filtrosTR[0] = search.createFilter({ name: 'custrecord_lmry_br_transaction', operator: 'anyof', values: billsAux });
        filtrosTR[1] = search.createFilter({ name: 'isinactive', operator: 'is', values: 'F' });
        filtrosTR[2] = search.createFilter({ name: 'custrecord_lmry_tax_type', operator: 'is', values: '1' });

        if (jsonSetupTax['subtypes']) {
          var auxTR = jsonSetupTax['subtypes'].split(',');
          filtrosTR[3] = search.createFilter({ name: 'custrecord_lmry_br_type_id', operator: 'anyof', values: auxTR });
        }

        var searchTaxResult = search.create({
          type: 'customrecord_lmry_br_transaction',
          columns: ['internalid', 'custrecord_lmry_br_transaction', search.createColumn({ name: 'expenseaccount', join: 'CUSTRECORD_LMRY_ITEM' }), 'custrecord_lmry_br_type_id', 'custrecord_lmry_account', 'custrecord_lmry_item', 'custrecord_lmry_br_positem'],
          filters: filtrosTR
        });

        var resultTaxResult = searchTaxResult.run().getRange({ start: 0, end: 1000 });

        if (resultTaxResult != null && resultTaxResult.length > 0) {
          var columnsTaxResult = resultTaxResult[0].columns;
          for (var i = 0; i < resultTaxResult.length; i++) {
            var bill = resultTaxResult[i].getValue('custrecord_lmry_br_transaction');
            jsonLog[currentLog]['bills'][bill].push(resultTaxResult[i].getValue('internalid'));

          }
        }
      }

      return jsonLog;

    }

    function eliminarArray(arreglo, elemento) {
      var i = arreglo.indexOf(elemento);

      if (i != -1) {
        arreglo.splice(i, 1);
      }

      return arreglo;
    }

    function jsonConcat(j1, j2) {
      for (var key in j2) {
        j1[key] = j2[key];
      }

      return j1;
    }

    function cleanVendorBillFields(objBill) {
      objBill.setValue('custbody_lmry_doc_ref_type', ''); //Latam - Document Type REF
      objBill.setValue('custbody_lmry_exchange_rate_doc_ref', ''); //LATAM - TYPE CHANGE DOC REF
      objBill.setValue('custbody_lmry_apply_wht_code', false); // LATAM - APPLIED WHT CODE
      objBill.setValue('custbody_lmry_carga_inicial	', false); //LATAM - INITIAL LOAD?
      objBill.setValue('custbody_lmry_cl_ei_exchangerate', ''); //Latam - EI Exchange Rate
      objBill.setValue('custbody_lmry_document_type', ''); //LATAM - LEGAL DOCUMENT TYPE
      objBill.setValue('custbody_lmry_doc_ref_date', ''); //LATAM - DOCUMENT DATE REF
      objBill.setValue('custbody_lmry_doc_serie_ref', ''); //LATAM - DOCUMENT SERIES REF
      objBill.setValue('custbody_lmry_fecha_retencion', ''); //LATAM - WITHHOLDING DATE
      objBill.setValue('custbody_lmry_numero_cc', ''); // LATAM - NUMERO CC
      objBill.setValue('custbody_lmry_numero_er', ''); // LATAM - NUMERO ER
      objBill.setValue('custbody_lmry_numero_cc', ''); // LATAM - NUMERO SR
      objBill.setValue('custbody_lmry_num_doc_ref', ''); //LATAM - DOCUMENT NUMBER REF
      objBill.setValue('custbody_lmry_num_preimpreso', '') //LATAM - PREPRINTED NUMBER
      objBill.setValue('custbody_lmry_paymentmethod', '') //LATAM - PAYMENT METHOD
      objBill.setValue('custbody_lmry_percep_num', '') //LATAM - PERCEPCION NUMBER
      objBill.setValue('custbody_lmry_preimpreso_retencion', '') //LATAM - WITHHOLDING TAX NUMBER
      objBill.setValue('custbody_lmry_serie_doc_cxp', '') //LATAM - CXP SERIES
      objBill.setValue('custbody_lmry_serie_retencion', '') //LATAM - SERIE RETENCION
      objBill.setValue('custbody_lmry_tipo_renta', '') //LATAM - TIPO DE RENTA
      objBill.setValue('custbody_lmry_type_report', '') //LATAM - TIPO DE INFORME
    }

    function setupTaxSubsidiary(subsidiary) {

      var setupTax = search.create({
        type: 'customrecord_lmry_setup_tax_subsidiary', columns: ['custrecord_lmry_setuptax_form_payment', 'custrecord_lmry_setuptax_form_journal', 'custrecord_lmry_setuptax_reclass_subtyps',
          'custrecord_lmry_setuptax_br_ap_interest', 'custrecord_lmry_setuptax_br_ap_multa', 'custrecord_lmry_setuptax_form_bill', 'custrecord_lmry_setuptax_br_document', 'custrecord_lmry_setuptax_br_tax_code'],
        filters: [{ name: 'isinactive', operator: 'is', values: 'F' }, { name: 'custrecord_lmry_setuptax_subsidiary', operator: 'is', values: subsidiary }]
      });

      var resultTax = setupTax.run().getRange({ start: 0, end: 1 });

      jsonSetupTax = {
        'itemInteres': resultTax[0].getValue('custrecord_lmry_setuptax_br_ap_interest'),
        'itemMulta': resultTax[0].getValue('custrecord_lmry_setuptax_br_ap_multa'),
        'formBill': resultTax[0].getValue('custrecord_lmry_setuptax_form_bill'),
        'formPayment': resultTax[0].getValue('custrecord_lmry_setuptax_form_payment'),
        'formJournal': resultTax[0].getValue('custrecord_lmry_setuptax_form_journal'),
        'documentType': resultTax[0].getValue('custrecord_lmry_setuptax_br_document'),
        'taxCode': resultTax[0].getValue('custrecord_lmry_setuptax_br_tax_code'),
        'subtypes': resultTax[0].getValue('custrecord_lmry_setuptax_reclass_subtyps')
      };

      log.error('jsonSetupTax', JSON.stringify(jsonSetupTax));

    }

    function createImportTaxResults(bills, percents, paymentId, accountingBooks) {
      log.error("bills", JSON.stringify(bills));
      log.error("percents", JSON.stringify(percents));

      if (Object.keys(bills).length) {
        var taxResults = {};

        var searchTaxResults = search.create({
          type: "customrecord_lmry_br_transaction",
          filters: [
            ["isinactive", "is", "F"], "AND",
            ["custrecord_lmry_tax_type", "anyof", "4"], "AND",
            ["custrecord_lmry_br_transaction", "anyof", Object.keys(bills)], "AND",
            ["custrecord_lmry_br_is_import_tax_result", "is", "T"]
          ],
          columns: [
            "internalid",
            "custrecord_lmry_br_transaction",
            "custrecord_lmry_br_type_id",
            "custrecord_lmry_ccl",
            "custrecord_lmry_ntax",
            "custrecord_lmry_ccl.custrecord_lmry_ccl_br_nivel_contabiliz",
            "custrecord_lmry_ntax.custrecord_lmry_nt_br_nivel_contabiliz",
            "custrecord_lmry_ccl.custrecord_lmry_ccl_gl_impact",
            "custrecord_lmry_ntax.custrecord_lmry_ntax_gl_impact",
            "custrecord_lmry_ccl.custrecord_lmry_ccl_br_reverse_account",
            "custrecord_lmry_ntax.custrecord_lmry_nt_br_reverse_account",
            "custrecord_lmry_ccl.custrecord_lmry_br_ccl_account2",
            "custrecord_lmry_ntax.custrecord_lmry_ntax_credit_account",
            "custrecord_lmry_base_amount",
            "custrecord_lmry_br_total",
            "custrecord_lmry_amount_local_currency",
            "custrecord_lmry_base_amount_local_currc"
          ]
        });

        var results = searchTaxResults.run().getRange(0, 1000);
        if (results && results.length) {
          for (var i = 0; i < results.length; i++) {
            var idCC = results[i].getValue("custrecord_lmry_ccl");
            var idNT = results[i].getValue("custrecord_lmry_ntax");
            var importTaxLevel = "";
            var creditAccount = "", reverseAccount = "", glImpact = false;
            if (idCC) {
              importTaxLevel = results[i].getValue({ join: "custrecord_lmry_ccl", name: "custrecord_lmry_ccl_br_nivel_contabiliz" });
              glImpact = results[i].getValue({ join: "custrecord_lmry_ccl", name: "custrecord_lmry_ccl_gl_impact" });
              creditAccount = results[i].getValue({ join: "custrecord_lmry_ccl", name: "custrecord_lmry_br_ccl_account2" });
              reverseAccount = results[i].getValue({ join: "custrecord_lmry_ccl", name: "custrecord_lmry_ccl_br_reverse_account" });
            } else if (idNT) {
              importTaxLevel = results[i].getValue({ join: "custrecord_lmry_ntax", name: "custrecord_lmry_nt_br_nivel_contabiliz" });
              glImpact = results[i].getValue({ join: "custrecord_lmry_ntax", name: "custrecord_lmry_ntax_gl_impact" });
              creditAccount = results[i].getValue({ join: "custrecord_lmry_ntax", name: "custrecord_lmry_ntax_credit_account" });
              reverseAccount = results[i].getValue({ join: "custrecord_lmry_ntax", name: "custrecord_lmry_nt_br_reverse_account" });
            }

            if (importTaxLevel && (!glImpact || (glImpact && creditAccount && reverseAccount))) {
              var subtype = results[i].getValue("custrecord_lmry_br_type");
              var billId = results[i].getValue("custrecord_lmry_br_transaction");
              billId = String(billId);
              var amount = results[i].getValue("custrecord_lmry_br_total") || 0.00;
              amount = parseFloat(amount);

              if (!taxResults[billId]) {
                taxResults[billId] = [];
              }

              var id = results[i].getValue("internalid");
              var subtype = results[i].getValue("custrecord_lmry_br_type_id");
              var baseAmount = results[i].getValue("custrecord_lmry_base_amount");
              var amount = results[i].getValue("custrecord_lmry_br_total");
              var locCurrAmt = results[i].getValue("custrecord_lmry_amount_local_currency");
              var locCurrBaseAmt = results[i].getValue("custrecord_lmry_base_amount_local_currc");


              taxResults[billId].push({
                "id": id,
                "subtype": subtype,
                "baseAmount": parseFloat(baseAmount),
                "amount": parseFloat(amount),
                "locCurrAmt": parseFloat(locCurrAmt),
                "locCurrBaseAmt": parseFloat(locCurrBaseAmt)
              });
            }

          }
        }

        log.error("import TaxResults", JSON.stringify(taxResults));
        for (var billId in bills) {
          for (var installmNum in percents[billId]) {
            var factor = parseFloat(percents[billId][installmNum]);
            log.error("factor", factor);

            if (taxResults[billId] && taxResults[billId].length) {
              for (var i = 0; i < taxResults[billId].length; i++) {
                var taxResult = taxResults[billId][i];

                var recordTaxResult = record.copy({
                  type: "customrecord_lmry_br_transaction",
                  id: taxResult["id"]
                });

                recordTaxResult.setValue({
                  fieldId: 'custrecord_lmry_br_related_id',
                  value: paymentId
                });

                recordTaxResult.setValue({
                  fieldId: 'custrecord_lmry_br_transaction',
                  value: paymentId
                });


                if (factor != 1) {
                  recordTaxResult.setValue({
                    fieldId: 'custrecord_lmry_base_amount',
                    value: round4(taxResult['baseAmount'] * factor)
                  });

                  recordTaxResult.setValue({
                    fieldId: 'custrecord_lmry_br_total',
                    value: round4(taxResult['amount'] * factor)
                  });

                  recordTaxResult.setValue({
                    fieldId: 'custrecord_lmry_total_base_currency',
                    value: round4(taxResult['locCurrAmt'] * factor)
                  });

                  recordTaxResult.setValue({
                    fieldId: 'custrecord_lmry_base_amount_local_currc',
                    value: parseFloat(taxResult['locCurrBaseAmt'] * factor)
                  });

                  recordTaxResult.setValue({
                    fieldId: 'custrecord_lmry_amount_local_currency',
                    value: parseFloat(taxResult['locCurrAmt'] * factor)
                  });
                }

                recordTaxResult.setValue({
                  fieldId: 'custrecord_lmry_related_applied_transact',
                  value: billId
                });

                recordTaxResult.setValue({
                  fieldId: 'custrecord_lmry_accounting_books',
                  value: accountingBooks
                });

                if (Number(installmNum)) {
                  recordTaxResult.setValue({
                    fieldId: "custrecord_lmry_related_installm_num",
                    value: installmNum
                  });
                }

                var idtaxresult = recordTaxResult.save({
                  ignoreMandatoryFields: true,
                  disableTriggers: true,
                  enableSourcing: true
                });

                log.error('idtaxresult', idtaxresult);
              }
            }
          }
        }
      }
    }

    function round4(num) {
      if (num >= 0) {
        return parseFloat(Math.round(parseFloat(num) * 1e4 + 1e-3) / 1e4);
      } else {
        return parseFloat(Math.round(parseFloat(num) * 1e4 - 1e-3) / 1e4);
      }
    }

    return {
      setLog: setLog,
      setupTaxSubsidiary: setupTaxSubsidiary,
      whtStandard: whtStandard,
      iteracionBill: iteracionBill,
      creadoTransacciones: creadoTransacciones
    };

  });
