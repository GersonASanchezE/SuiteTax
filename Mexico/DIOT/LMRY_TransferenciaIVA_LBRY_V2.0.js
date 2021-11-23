/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_TransferenciaIVA_LBRY_V2.0.js               ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 05 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/log', 'N/record', 'N/search', 'N/runtime', '../Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
  function (log, record, search, runtime, library) {

    var LMRY_script = 'LatamReady - Transferencia IVA LBRY V2.0';
    var TYPE_LINE_MAP = {
      'custinvc': 'invoice',
      'vendbill': 'vendorbill',
      'exprept': 'expensereport'
    };

    function deleteTransactionIVA(scriptContext) {
      try {
        var oldRecord = scriptContext.oldRecord;
        var id_transaction = scriptContext.oldRecord.id;
        var num_apply = oldRecord.getLineCount({ sublistId: 'apply' });

        var idlines = [];
        var typeLines = [];
        for (var i = 0; i < num_apply; i++) {
          var lineID = oldRecord.getSublistValue({ sublistId: 'apply', fieldId: 'doc', line: i });
          var is_apply = oldRecord.getSublistValue({ sublistId: 'apply', fieldId: 'apply', line: i });
          var lineType = oldRecord.getSublistValue({ sublistId: 'apply', fieldId: 'trantype', line: i }).toLowerCase();

          if (is_apply == 'T' || is_apply == true) {
            idlines.push(lineID);
            typeLines.push(TYPE_LINE_MAP[lineType]);
          }
        }

        //Se busca todas las transacciones pagadas que tienen otros pagos
        var search_gl_lines = search.create({
          type: "customrecord_lmry_gl_lines_plug_state",
          filters:
            [
              ["custrecord_lmry_gl_lines_plug_line.internalid", "anyof", idlines], "AND",
              ["custrecord_lmry_gl_lines_plug_tran.internalid", "noneof", id_transaction], "AND",
              ["custrecord_lmry_gl_lines_plug_line.mainline", "is", "T"], "AND",
              ["custrecord_lmry_gl_lines_plug_tran.mainline", "is", "T"]
            ],
          columns:
            [
              search.createColumn({
                name: "internalid",
                join: "CUSTRECORD_LMRY_GL_LINES_PLUG_LINE",
                summary: "GROUP",
                sort: search.Sort.ASC
              }),
              search.createColumn({
                name: "internalid",
                join: "CUSTRECORD_LMRY_GL_LINES_PLUG_TRAN",
                summary: "GROUP"
              })
            ]
        });

        var payments_by_line = search_gl_lines.run().getRange(0, 1000);
        var columnsgl = search_gl_lines.columns;
        for (var i = 0; i < idlines.length; i++) {
          var encontrado = false;
          //Si esta en la busqueda, tiene otros pagos y no se debe actualizar su estado
          if (payments_by_line && payments_by_line.length) {
            for (var j = 0; j < payments_by_line.length; j++) {
              var id_trans = payments_by_line[j].getValue(columnsgl[0]);
              if (Number(idlines[i]) == Number(id_trans)) {
                encontrado = true;
                break;
              }
            }
          }

          if (!encontrado) {
            record.submitFields({
              type: typeLines[i],
              id: idlines[i],
              values: { 'custbody_lmry_schedule_transfer_of_iva': '2' }
            });
          }
        }
        //se eliminan los record plug-in status
        deleteRecordGL(id_transaction);

      } catch (err) {
        //library.sendemail(' [ deleteTransactionIVA ] ' + err, LMRY_script);
        log.error('[ deleteTransactionIVA ]', err);
        throw LMRY_script + ' [ deleteTransactionIVA ] ' + err;
      }
    }


    function afterSubmitTrasladoIva(scriptContext) {
      var newRecord = scriptContext.newRecord
      var typeTransaction = scriptContext.newRecord.type;

      try {
        var idpayment = newRecord.id;
        var account = newRecord.getValue('account');

        var subsidiary = newRecord.getValue({
          fieldId: 'subsidiary'
        });

        var payment_status = '2';

        if (verificarSetupTax(subsidiary, typeTransaction) == false) {
          payment_status = '9'; //error de configuracion
        }

        if (verificarCuentasExentas(account) == true) {
          payment_status = '3'; //error por cuenta excluida
        }

        if (payment_status == '9' || payment_status == '3') {
          record.submitFields({
            type: typeTransaction, id: idpayment,
            values: { custbody_lmry_schedule_transfer_of_iva: payment_status },
            enableSourcing: true,
            ignoreMandatoryFields: true
          });

          return true;
        }

        if (scriptContext.type == 'edit') {
          deleteRecordGL(idpayment);
        }

        var count_apply = newRecord.getLineCount({ sublistId: 'apply' });
        var memo = "Latam - IVA Transference";
        var search_lines = search.create({
          type: typeTransaction,
          filters:
            [
              ["internalid", "anyof", idpayment], "AND", ["memo", "startswith", memo]
            ],
          columns:
            [
              search.createColumn({ name: "internalid", summary: "GROUP" }),
              //search.createColumn({ name: "accountingbook", join: "accountingTransaction", summary: "GROUP"}),
              search.createColumn({ name: "memo", summary: "GROUP" })
            ]
        });

        var linesgl = search_lines.run().getRange(0, 1000);
        var columnsgl = search_lines.columns;
        var generated = false;
        for (var i = 0; i < count_apply; i++) {
          var status_line = '4'; //no genero gl
          var id_apply = newRecord.getSublistValue({ sublistId: 'apply', fieldId: 'doc', line: i });
          var typeLine = newRecord.getSublistValue({ sublistId: 'apply', fieldId: 'trantype', line: i }).toLowerCase();
          var is_apply = newRecord.getSublistValue({ sublistId: 'apply', fieldId: 'apply', line: i });

          if (is_apply == 'T' || is_apply == true) {
            //se verifica si se genero un linea de GL para esta transaccion.
            if (linesgl && linesgl.length) {
              var encontrado = false;
              for (var j = 0; j < linesgl.length; j++) {
                var aux = linesgl[j].getValue(columnsgl[1]).split('ID: ')[1];
                log.error('[ aux ]', aux);
                var id_line = aux.substring(0, aux.length - 1); //obtiene id

                if (Number(id_apply) == Number(id_line)) {
                  encontrado = true;
                  break;
                }
              }
              if (encontrado) {
                status_line = '1';
                generated = true;
              }
            }

            record.submitFields({
              type: TYPE_LINE_MAP[typeLine], id: id_apply,
              values: { custbody_lmry_schedule_transfer_of_iva: status_line },
              enableSourcing: true,
              ignoreMandatoryFields: true
            });
            addRecordGL(idpayment, id_apply, status_line);
          }
        }

        if (generated) {//si genero al menos uno
          payment_status = '1';
        }

        record.submitFields({
          type: typeTransaction, id: idpayment,
          values: { custbody_lmry_schedule_transfer_of_iva: payment_status },
          enableSourcing: true,
          ignoreMandatoryFields: true
        });
      }
      catch (err) {
        //library.sendemail(' [ afterSubmitTrasladoIva ] ' + error, LMRY_script);
        log.error('[ afterSubmitTrasladoIva ]', err);
        throw LMRY_script + ' [ afterSubmitTrasladoIva ] ' + err;
      }
    }


    function verificarCuentasExentas(account) {
      if (account) {
        var search_no_account = search.create({
          type: 'customrecord_lmry_account_no_transferiva',
          filters: [
            ['custrecord_lmry_account_no_transferiva', 'anyof', account], 'AND',
            ['isinactive', 'is', 'F']
          ],
          columns: [search.createColumn({ name: "internalid" })]
        });

        var results = search_no_account.run().getRange(0, 10);
        if (results && results.length) {
          return true;
        }
      }

      return false;
    }


    function verificarSetupTax(subsidiary, typeTransaction) {
      var search_setup_tx = search.create({
        type: 'customrecord_lmry_setup_tax_subsidiary',
        filters: [
          ['isinactive', 'is', 'F'], 'AND',
          ['custrecord_lmry_setuptax_subsidiary', 'is', subsidiary]
        ],
        columns: [
          'custrecord_lmry_setuptax_iva_debitpurch',
          'custrecord_lmry_setuptax_iva_creditpurch',
          'custrecord_lmry_setuptax_iva_earningpurc',
          'custrecord_lmry_setuptax_iva_deficitpurc',
          'custrecord_lmry_setuptax_iva_debitsales',
          'custrecord_lmry_setuptax_iva_creditsales',
          'custrecord_lmry_setuptax_iva_earningsale',
          'custrecord_lmry_setuptax_iva_deficitsale'
        ]
      });

      var setup_txs = search_setup_tx.run().getRange(0, 100);
      if (setup_txs && setup_txs.length) {
        var accountDebit = setup_txs[0].getValue("custrecord_lmry_setuptax_iva_debitpurch");
        var accountCredit = setup_txs[0].getValue("custrecord_lmry_setuptax_iva_creditpurch");
        var accEarningSetup = setup_txs[0].getValue("custrecord_lmry_setuptax_iva_earningpurc");
        var accDeficitSetup = setup_txs[0].getValue("custrecord_lmry_setuptax_iva_deficitpurc");

        log.error('typeTransaction', typeTransaction);

        if (typeTransaction == 'customerpayment') {
          accountDebit = setup_txs[0].getValue("custrecord_lmry_setuptax_iva_debitsales");
          accountCredit = setup_txs[0].getValue("custrecord_lmry_setuptax_iva_creditsales");
          accEarningSetup = setup_txs[0].getValue("custrecord_lmry_setuptax_iva_earningsale");
          accDeficitSetup = setup_txs[0].getValue("custrecord_lmry_setuptax_iva_deficitsale");
        }

        if (accountDebit && accountCredit && accEarningSetup && accDeficitSetup) {
          return true
        } else {
          return false;
        }
      }
      else {
        return false;
      }
    }


    function deleteRecordGL(idTransaction) {
      var log_search = search.create({
        type: 'customrecord_lmry_gl_lines_plug_state',
        filters: [
          ["custrecord_lmry_gl_lines_plug_tran", "is", idTransaction]
        ],
        columns: [
          search.createColumn({ name: "internalid" }),
        ]
      });

      var log_gls = log_search.run().getRange(0, 1000);

      for (var i = 0; i < log_gls.length; i++) {
        var id_log = log_gls[i].getValue('internalid');
        record.delete({
          type: 'customrecord_lmry_gl_lines_plug_state',
          id: id_log,
        });
      }
    }

    function addRecordGL(idTransaction, idline, statusLine) {
      var newloggl = record.create({
        type: 'customrecord_lmry_gl_lines_plug_state',
        isDynamic: false
      });

      newloggl.setValue('custrecord_lmry_gl_lines_plug_tran', idTransaction);
      newloggl.setValue('custrecord_lmry_gl_lines_plug_line', idline);
      newloggl.setValue('custrecord_lmry_gl_lines_plug_stat', statusLine);
      //newloggl.setValue('custrecord_lmry_gl_lines_plug_book', bookLine);
      newloggl.setValue('custrecord_lmry_gl_lines_plug_schdl', '2');
      newloggl.save(true, true);
    }

    return {
      deleteTransactionIVA: deleteTransactionIVA,
      afterSubmitTrasladoIva: afterSubmitTrasladoIva
    };

  });
