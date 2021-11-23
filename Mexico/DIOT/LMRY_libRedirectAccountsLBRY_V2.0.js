/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_libRedirectAccountsLBRY_V2.0.js				      ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 20 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/search', 'N/log', 'N/record', 'N/format', 'N/runtime', './LMRY_libSendingEmailsLBRY_V2.0'],

  function(search, log, record, format, runtime, Library_Mail) {

    var ST_FEATURE = false;

    /* ------------------------------------------------------------------------------------------------------
     * Funcion que se encarga de reclasificar
     * --------------------------------------------------------------------------------------------------- */
    function Create_Redirect_Inv(ID) {
      try {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var Obj_RCD = record.load({
          type: record.Type.INVOICE,
          id: ID
        });

        // Valida que no esta vacio el ID
        if (ID == '' || ID == null) {
          return true;
        }

        // Transaccion
        if(ST_FEATURE === true || ST_FEATURE === "T") {
          var savedsearch = search.load({ id: 'customsearch_lmry_st_rdct_trans_sales' });
        } else {
          var savedsearch = search.load({ id: 'customsearch_lmry_redirtransactionsales' });
        }

        savedsearch.filters.push(search.createFilter({
          name: 'internalid',
          operator: search.Operator.ANYOF,
          values: [ID]
        }));
        var searchresult = savedsearch.run();
        var invoice = searchresult.getRange(0, 1000);

        if (invoice != null && invoice != '') {
          //log.error('Create_Redirect_Inv - Paso 1 ' + ID, 'Result ' + invoice.length);

          // Valida si hay resultado
          if (invoice.length == 0) {
            return true;
          }
          // Trae todos los campos
          var columns = invoice[0].columns;
          // Cliente
          var custname = invoice[0].getValue(columns[5]);
          // Departament, Class, Location
          var detadepa = invoice[0].getValue(columns[9]);
          var detaclas = invoice[0].getValue(columns[10]);
          var detaloca = invoice[0].getValue(columns[11]);
          // Moneda, Tipo de cambio y Subsidiary
          var currencycob = invoice[0].getValue(columns[12]);
          var exchangerate = invoice[0].getValue(columns[13]);
          var detasubs = invoice[0].getValue(columns[14]);
          // Fecha de la factura origen
          var detetran = invoice[0].getValue(columns[16]);
          var peritran = invoice[0].getValue(columns[17]);

          //log.error('Create_Redirect_Inv - detetran', detetran);

          // Creacion del Asiento Diario
          var jeRec = record.create({
            type: record.Type.JOURNAL_ENTRY,
            isDynamic: true
          });

          // Subsidiary, Departament, Class, Location
          jeRec.setValue({
            fieldId: 'subsidiary',
            value: detasubs
          });
          jeRec.setValue({
            fieldId: 'department',
            value: detadepa
          });
          jeRec.setValue({
            fieldId: 'class',
            value: detaclas
          });
          jeRec.setValue({
            fieldId: 'location',
            value: detaloca
          });
          jeRec.setValue({
            fieldId: 'currency',
            value: currencycob
          });
          jeRec.setValue({
            fieldId: 'exchangerate',
            value: exchangerate
          });
          // Fecha


          var FormatoIn = Obj_RCD.getValue({
            fieldId: 'trandate'
          });

          var FormatoFecha = format.parse({
            value: FormatoIn,
            type: format.Type.DATE
          });

          jeRec.setValue({
            fieldId: 'trandate',
            value: FormatoFecha
          });

          jeRec.setValue({
            fieldId: 'postingperiod',
            value: peritran
          });
          // Campos Latam Ready
          jeRec.setValue({
            fieldId: 'custbody_lmry_reference_transaction',
            value: ID
          });
          jeRec.setValue({
            fieldId: 'custbody_lmry_reference_transaction_id',
            value: ID
          });
          jeRec.setValue({
            fieldId: 'custbody_lmry_reference_entity',
            value: custname
          });

          // Detalle
          for (var i = 0; i < invoice.length; i++) {
            // Trae todos los campos
            var columns = invoice[i].columns;
            // Contenido de las columnas
            var interid = invoice[i].getValue(columns[0]);
            var account = invoice[i].getValue(columns[1]);
            var duedate = invoice[i].getValue(columns[2]);
            var taxitem = invoice[i].getText(columns[3]);
            var taxtasa = invoice[i].getValue(columns[4]);

            var invmemo = invoice[i].getValue(columns[6]);
            var amdebit = invoice[i].getValue(columns[7]);
            var acredit = invoice[i].getValue(columns[8]);
            var country = invoice[i].getText(columns[15]);

            // Criterio de la busqueda
            var filters = new Array();
            filters[0] = search.createFilter({
              name: 'custrecord_lmry_redirectionacc_transacc',
              operator: search.Operator.ANYOF,
              values: [account]
            });
            var columns = new Array();
            columns[0] = search.createColumn({
              name: 'custrecord_lmry_redirectionacc_country'
            });
            columns[1] = search.createColumn({
              name: 'custrecord_lmry_redirectionacc_crit1'
            });
            columns[2] = search.createColumn({
              name: 'custrecord_lmry_redirectionacc_acc_from'
            });
            columns[3] = search.createColumn({
              name: 'custrecord_lmry_redirectionacc_acc_to'
            });
            var rediacc = search.create({
              type: 'customrecord_lmry_redirection_accounts',
              columns: columns,
              filters: filters
            })
            rediacc = rediacc.run().getRange(0, 1000);

            if (rediacc != null && rediacc != '') {

              //log.error('Create_Redirect_Inv - Paso 2 - rediacc ', rediacc);

              // Variables
              var criteria = 0;
              var recaccfr = 0;
              var recaccto = 0;
              for (var fil = 0; fil < rediacc.length; fil++) {
                criteria = rediacc[fil].getValue('custrecord_lmry_redirectionacc_crit1');
                // Criterio de reclasificacion de cuentas
                // 1 - Dias de vencimiento = 0 Y taxcode.rate>0% Y taxcode.exempt = No
                if (criteria == 1 && parseInt(duedate) == 0 && taxtasa > 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_to');
                  break;
                }
                // 2 - Dias de vencimiento = 0 Y taxcode.rate=0% Y taxcode.exempt = No
                if (criteria == 2 && parseInt(duedate) == 0 && taxtasa == 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_to');
                  break;
                }
                // 3 - Dias de vencimiento = 0 Y taxcode.rate=0% Y taxcode.exempt = Yes
                if (criteria == 3 && parseInt(duedate) == 0 && taxtasa == 0 && (taxitem == 'E-MX' || taxitem == 'IE-MX')) {
                  recaccfr = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_to');
                  break;
                }
                // 4 - Dias de vencimiento > 0 Y taxcode.rate>0% Y taxcode.exempt = No
                if (criteria == 4 && parseInt(duedate) > 0 && taxtasa > 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_to');
                  break;
                }
                // 5 - Dias de vencimiento > 0 Y taxcode.rate=0% Y taxcode.exempt = No
                if (criteria == 5 && parseInt(duedate) > 0 && taxtasa == 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_to');
                  break;
                }
                // 6 - Dias de vencimiento > 0 Y taxcode.rate=0% Y taxcode.exempt = Yes
                if (criteria == 6 && parseInt(duedate) > 0 && taxtasa == 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[fil].getValue('custrecord_lmry_redirectionacc_acc_to');
                  break;
                }
              } // Fin for

              //log.error('Create_Redirect_Inv - Paso 3 - recaccfr, recaccto ', recaccfr + ', ' + recaccto);

              // Detalle del Journal
              if (recaccfr != 0 && recaccto != 0) {
                //Linea de debito
                jeRec.selectNewLine({
                  sublistId: 'line'
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'account',
                  value: recaccfr
                });
                if (amdebit == '' || amdebit == null) {
                  jeRec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    value: format.format({
                      value: acredit,
                      type: format.Type.CURRENCY
                    })
                  });
                }
                if (acredit == '' || acredit == null) {
                  jeRec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    value: format.format({
                      value: amdebit,
                      type: format.Type.CURRENCY
                    })
                  });
                }
                jeRec.etCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'entity',
                  value: custname
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'memo',
                  value: invmemo
                });
                // Departament, Class, Location
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'department',
                  value: detadepa
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'class',
                  value: detaclas
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'location',
                  value: detaloca
                });
                jeRec.commitLine({
                  sublistId: 'line'
                });
                //Linea de credito
                jeRec.selectNewLine({
                  sublistId: 'line'
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'account',
                  value: recaccto
                });

                if (amdebit == '' || amdebit == null) {
                  jeRec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    value: format.format({
                      value: acredit,
                      type: format.Type.CURRENCY
                    })
                  });
                }
                if (acredit == '' || acredit == null) {
                  jeRec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    value: format.format({
                      value: amdebit,
                      type: format.Type.CURRENCY
                    })
                  });
                }
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'entity',
                  value: custname
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'memo',
                  value: invmemo
                });
                // Departament, Class, Location
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'department',
                  value: detadepa
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'class',
                  value: detaclas
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'location',
                  value: detaloca
                });
                jeRec.commitLine({
                  sublistId: 'line'
                });
              } // Fin detalle del Journal
            }
          }

          // Graba el Journal
          var JECount = jeRec.getLineCount({
            sublistId: 'line'
          });

          var newrec = 0;
          if (JECount > 0) {
            newrec = jeRec.save();
          }

          //log.error('Create_Redirect_Inv - - Paso 4 New JE', newrec);
        }
      } catch (error) {

        Library_Mail.sendemail(' [ Create_Redirect_Inv ] ' + error, 'LMRY_libRedirectAccountsLBRY');
      }
    }

    /* ------------------------------------------------------------------------------------------------------
     * Funcion que se encarga de reclasificar
     * --------------------------------------------------------------------------------------------------- */
    function Create_Redirect_CM(ID) {
      try {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        // Valida que no esta vacio el ID
        if (ID == '' || ID == null) {
          return true;
        }

        // Transaccion
        if(ST_FEATURE === true || ST_FEATURE === "T") {
          var savedsearch = search.load({ id: 'customsearch_lmry_st_rdct_trans_sales' });
        } else {
          var savedsearch = search.load({ id: 'customsearch_lmry_redirtransactionsales' });
        }
        savedsearch.filters.push(search.createFilter({
          name: 'internalid',
          operator: search.Operator.ANYOF,
          values: [ID]
        }));

        var searchresult = savedsearch.run();
        var creditmemo = searchresult.getRange(0, 1000);
        if (creditmemo != null && creditmemo != '') {
          //log.error('Create_Redirect_CM - ID ' + ID, 'Result ' + creditmemo.length);

          // Valida si hay resultado
          if (creditmemo.length == 0) {
            return true;
          }

          // Trae todos los campos
          var columns = creditmemo[0].columns;
          // Cliente
          var custname = creditmemo[0].getValue(columns[5]);
          // Departament, Class, Location
          var detadepa = creditmemo[0].getValue(columns[9]);
          var detaclas = creditmemo[0].getValue(columns[10]);
          var detaloca = creditmemo[0].getValue(columns[11]);
          // Moneda, Tipo de cambio y Subsidiary
          var currencycob = creditmemo[0].getValue(columns[12]);
          var exchangerate = creditmemo[0].getValue(columns[13]);
          var detasubs = creditmemo[0].getValue(columns[14]);
          // Fecha de la factura origen
          var detetran = creditmemo[0].getValue(columns[16]);
          var peritran = creditmemo[0].getValue(columns[17]);

          //log.error('Create_Redirect_CM - detetran', detetran);

          // Creacion del Asiento Diario
          var jeRec = record.create({
            type: record.Type.JOURNAL_ENTRY
          });
          // Subsidiary, Departament, Class, Location
          jeRec.setValue({
            fieldId: 'subsidiary',
            value: detasubs
          });
          jeRec.setValue({
            fieldId: 'department',
            value: detadepa
          });
          jeRec.setValue({
            fieldId: 'class',
            value: detaclas
          });
          jeRec.setValue({
            fieldId: 'location',
            value: detaloca
          });
          jeRec.setValue({
            fieldId: 'currency',
            value: currencycob
          });
          jeRec.setValue({
            fieldId: 'exchangerate',
            value: exchangerate
          });
          // Fecha
          jeRec.setValue({
            fieldId: 'trandate',
            value: detetran
          });
          jeRec.setValue({
            fieldId: 'postingperiod',
            value: peritran
          });
          // Campos Latam Ready
          jeRec.setValue({
            fieldId: 'custbody_lmry_reference_transaction',
            value: ID
          });
          jeRec.setValue({
            fieldId: 'custbody_lmry_reference_transaction_id',
            value: ID
          });
          jeRec.setValue({
            fieldId: 'custbody_lmry_reference_entity',
            value: custname
          });

          // Detalle
          for (var i = 0; i < creditmemo.length; i++) {
            // Trae todos los campos
            var columns = creditmemo[i].columns;
            // Contenido de las columnas
            var interid = creditmemo[i].getValue(columns[0]);
            var account = creditmemo[i].getValue(columns[1]);
            var duedate = creditmemo[i].getValue(columns[2]);
            var taxitem = creditmemo[i].getText(columns[3]);
            var taxtasa = creditmemo[i].getValue(columns[4]);

            var invmemo = creditmemo[i].getValue(columns[6]);
            var amdebit = creditmemo[i].getValue(columns[7]);
            var acredit = creditmemo[i].getValue(columns[8]);
            var country = creditmemo[i].getText(columns[15]);

            // Criterio de la busqueda
            var filters = new Array();
            filters[0] = search.createFilter({
              name: 'custrecord_lmry_redirectionacc_country',
              operator: search.Operator.ANYOF,
              values: [country]
            });
            new nlobjSearchFilter('custrecord_lmry_redirectionacc_country', null, 'anyof', country);
            filters[1] = search.createFilter({
              name: 'custrecord_lmry_redirectionacc_transacc',
              operator: search.Operator.ANYOF,
              values: [account]
            });
            var columns = new Array();
            columns[0] = search.createColumn({
              name: 'custrecord_lmry_redirectionacc_crit1'
            });
            columns[1] = search.createColumn({
              name: 'custrecord_lmry_redirectionacc_acc_from'
            });
            columns[2] = search.createColumn({
              name: 'custrecord_lmry_redirectionacc_acc_to'
            });
            var rediacc = search.create({
              type: 'customrecord_lmry_redirection_accounts',
              columns: columns,
              filters: filters
            });
            rediacc = rediacc.run().getRange(0, 1000);
            if (rediacc != null && rediacc != '') {
              var criteria = 0;
              var recaccfr = 0;
              var recaccto = 0;
              for (var i = 0; i < rediacc.length; i++) {
                criteria = rediacc[i].getValue('custrecord_lmry_redirectionacc_crit1');
                // Criterio de reclasificacion de cuentas
                // 1 - Dias de vencimiento = 0 Y taxcode.rate>0% Y taxcode.exempt = No
                if (criteria == 1 && parseInt(duedate) == 0 && taxtasa > 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_to');
                }
                // 2 - Dias de vencimiento = 0 Y taxcode.rate=0% Y taxcode.exempt = No
                if (criteria == 2 && parseInt(duedate) == 0 && taxtasa == 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_to');
                }
                // 3 - Dias de vencimiento = 0 Y taxcode.rate=0% Y taxcode.exempt = Yes
                if (criteria == 3 && parseInt(duedate) == 0 && taxtasa == 0 && (taxitem == 'E-MX' || taxitem == 'IE-MX')) {
                  recaccfr = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_to');
                }
                // 4 - Dias de vencimiento > 0 Y taxcode.rate>0% Y taxcode.exempt = No
                if (criteria == 4 && parseInt(duedate) > 0 && taxtasa > 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_to');
                }
                // 5 - Dias de vencimiento > 0 Y taxcode.rate=0% Y taxcode.exempt = No
                if (criteria == 5 && parseInt(duedate) > 0 && taxtasa == 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_to');
                }
                // 6 - Dias de vencimiento > 0 Y taxcode.rate=0% Y taxcode.exempt = Yes
                if (criteria == 6 && parseInt(duedate) > 0 && taxtasa == 0 && (taxitem != 'E-MX' && taxitem != 'IE-MX')) {
                  recaccfr = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_from');
                  recaccto = rediacc[i].getValue('custrecord_lmry_redirectionacc_acc_to');
                }
              }

              // Detalle del Journal
              if (recaccfr != 0 && recaccto != 0) {
                //Linea de debito
                jeRec.selectNewLine({
                  sublistId: 'line'
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'account',
                  value: recaccfr
                });
                if (amdebit == '' || amdebit == null) {
                  jeRec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    value: format.format({
                      value: acredit,
                      type: format.Type.CURRENCY
                    })
                  });
                }
                if (acredit == '' || acredit == null) {
                  jeRec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    value: format.format({
                      value: amdebit,
                      type: format.Type.CURRENCY
                    })
                  });
                }

                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'entity',
                  value: custname
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'memo',
                  value: invmemo
                });
                // Departament, Class, Location
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'department',
                  value: detadepa
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'class',
                  value: detaclas
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'location',
                  value: detaloca
                });
                jeRec.commitLine({
                  sublistId: 'line'
                });
                //Linea de credito
                jeRec.selectNewLine({
                  sublistId: 'line'
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'account',
                  value: recaccto
                });

                if (amdebit == '' || amdebit == null) {
                  jeRec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    value: format.format({
                      value: acredit,
                      type: format.Type.CURRENCY
                    })
                  });
                }
                if (acredit == '' || acredit == null) {
                  jeRec.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    value: format.format({
                      value: amdebit,
                      type: format.Type.CURRENCY
                    })
                  });
                }

                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'entity',
                  value: custname
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'memo',
                  value: invmemo
                });
                // Departament, Class, Location
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'department',
                  value: detadepa
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'class',
                  value: detaclas
                });
                jeRec.setCurrentSublistValue({
                  sublistId: 'line',
                  fieldId: 'location',
                  value: detaloca
                });
                jeRec.commitLine({
                  sublistId: 'line'
                });
              }
            }
          }
          // Graba el Journal
          var JECount = jeRec.getLineCount({
            sublistId: 'line'
          });
          if (JECount > 0) {
            var newrec = jeRec.save();
          }
        }
      } catch (error) {
        Library_Mail.sendemail(' [ Create_Redirect_CM ] ' + error, 'LMRY_libRedirectAccountsLBRY');
      }
    }

    return {
      Create_Redirect_Inv: Create_Redirect_Inv,
      Create_Redirect_CM: Create_Redirect_CM
    };

  });
