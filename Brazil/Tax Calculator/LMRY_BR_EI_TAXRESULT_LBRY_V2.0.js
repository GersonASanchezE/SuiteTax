/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_EI_TAXRESULT_LBRY_V2.0.js 		            ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jan 17 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
define(['N/search', 'N/record', 'N/log', 'N/runtime'],
  function(search, record, log, runtime) {

    var totalItemTaxes = {};
    var taxNoAddLine = {};

    // SUITETAX FEATURE
    var ST_FEATURE = false;

    //{ position : i, item : item, xml }[]
    function SendTaxCalcRsp(recordObj, arrayResponses) {

      ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

      if (recordObj) {
        var recordType = recordObj.getValue('baserecordtype');
        log.error('recordType', recordType);
        if (recordObj.id) {
          deleteTaxResults(recordObj);
          deleteTaxLines(recordObj);
        }

        var subsidiary = recordObj.getValue('subsidiary');
        var filters = [
          ['isinactive', 'is', 'F']
        ];

        var featureSubs = runtime.isFeatureInEffect({
          feature: "SUBSIDIARIES"
        });

        if (featureSubs) {
          filters.push('AND', ['custrecord_lmry_setuptax_subsidiary', 'is', subsidiary]);
        }

        var search_setuptax = search.create({
          type: "customrecord_lmry_setup_tax_subsidiary",
          filters: filters,
          columns: ['custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_br_taxfromgross', 'custrecord_lmry_setuptax_department', 'custrecord_lmry_setuptax_class', 'custrecord_lmry_setuptax_location']
        });

        var results = search_setuptax.run().getRange(0, 10);
        if (results && results.length) {
          var currencySetup = results[0].getValue('custrecord_lmry_setuptax_currency');
          var caseBR = results[0].getValue('custrecord_lmry_setuptax_br_taxfromgross') || 1;
          caseBR = Number(caseBR);
          var depSetup = results[0].getValue('custrecord_lmry_setuptax_department');
          var classSetup = results[0].getValue('custrecord_lmry_setuptax_class');
          var locSetup = results[0].getValue('custrecord_lmry_setuptax_location');

          var exchangeRate = getExchangeRate(recordObj, currencySetup);

          var featureMB = runtime.isFeatureInEffect({
            feature: "MULTIBOOK"
          });
          var featureMultiPrice = runtime.isFeatureInEffect({
            feature: 'multprice'
          });

          if (ST_FEATURE === true || ST_FEATURE === "T") {

            // Tax Type y Tax Code para SuiteTax
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

          }

          var concatAccountBooks = concatenarAccountingBooks(recordObj, featureMB);
          for (var i = 0; i < arrayResponses.length; i++) {
            var position = arrayResponses[i]['position'];
            var idItem = arrayResponses[i]['item'];
            var response = arrayResponses[i]['xml'];

            var catalog = recordObj.getSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_lmry_br_service_catalog',
              line: position
            });

            var lineUniqueKey = '';
            if (recordObj.getSublistField({
                sublistId: 'item',
                fieldId: 'lineuniquekey',
                line: position
              })) {
              lineUniqueKey = recordObj.getSublistValue({
                sublistId: 'item',
                fieldId: 'lineuniquekey',
                line: position
              });
            }

            if (!catalog && response) {
              var merchOrig = recordObj.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_lmry_br_origin_code',
                line: position
              });
              if (recordType != 'itemfulfillment') {
                var dsctoValue = recordObj.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_lmry_col_sales_discount',
                  line: position
                }) || 0.00;
                var baseAmount = recordObj.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'amount',
                  line: position
                });
                var netamt = recordObj.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'amount',
                  line: position
                });
                netamt = round2(netamt);
                var grossamt = recordObj.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'grossamt',
                  line: position
                });
                grossamt = round2(grossamt);
                if (caseBR == 1 || caseBR == 3 || caseBR == 4) {
                  if (caseBR == 3 || caseBR == 4) {
                    var oldBaseAmount = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'custcol_lmry_br_base_amount',
                      line: position
                    }) || 0.00;
                    oldBaseAmount = round2(oldBaseAmount);
                    baseAmount = oldBaseAmount;

                    var oldTotalImpuestos = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'custcol_lmry_br_total_impuestos',
                      line: position
                    }) || 0.00;
                    oldTotalImpuestos = round2(oldTotalImpuestos);

                    var newNetAmt = parseFloat(netamt) - parseFloat(oldTotalImpuestos);
                    newNetAmt = round2(newNetAmt);

                    if (newNetAmt == oldBaseAmount) {
                      netamt = oldBaseAmount;
                      baseAmount = oldBaseAmount;
                    }
                  }
                } else {
                  baseAmount = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'grossamt',
                    line: position
                  });
                }

                var arr_auxTR = [];
                // var totalTaxAmount = agregarTaxCalculatorBR(recordObj, idItem, exchangeRate, response, position, lineUniqueKey, baseAmount, concatAccountBooks);
                arr_auxTR = agregarTaxCalculatorBR(recordObj, idItem, exchangeRate, response, position, lineUniqueKey, baseAmount, concatAccountBooks, merchOrig, dsctoValue);
                addItemTaxFromColumns(recordObj, position);

                var quantity = recordObj.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'quantity',
                  line: position
                });
                quantity = parseFloat(quantity);

                var totalTaxAmount = parseFloat(arr_auxTR[arr_auxTR.length - 1]);

                if (!ST_FEATURE) {

                  if (totalTaxAmount > 0) {
                    recordObj.setSublistValue('item', 'custcol_lmry_br_total_impuestos', position, parseFloat(arr_auxTR[arr_auxTR.length - 1]));
                  }

                  var grossAmnt = 0;

                  if (caseBR == 1) {
                    recordObj.setSublistValue('item', 'tax1amt', position, arr_auxTR[arr_auxTR.length - 1]);
                    recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', position, round2(netamt));
                    grossAmnt = grossamt;
                  } else if (caseBR == 2) {
                    var newNetAmt = parseFloat(grossamt) - parseFloat(arr_auxTR[arr_auxTR.length - 1]);
                    var rate = newNetAmt / quantity;

                    if (featureMultiPrice == true || featureMultiPrice == 'T') {
                      recordObj.setSublistValue('item', 'price', position, -1);
                    }

                    recordObj.setSublistValue('item', 'rate', position, round2(rate));
                    recordObj.setSublistValue('item', 'amount', position, round2(newNetAmt));
                    recordObj.setSublistValue('item', 'tax1amt', position, round2(arr_auxTR[arr_auxTR.length - 1]));
                    recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', position, round2(grossamt));
                    grossAmnt = grossamt;

                  } else if (caseBR == 3) {
                    var newNetAmt = netamt + arr_auxTR[arr_auxTR.length - 1];
                    var rate = parseFloat(newNetAmt) / quantity;

                    if (featureMultiPrice == true || featureMultiPrice == 'T') {
                      recordObj.setSublistValue('item', 'price', position, -1);
                    }

                    recordObj.setSublistValue('item', 'rate', position, round2(rate));
                    recordObj.setSublistValue('item', 'amount', position, round2(newNetAmt));
                    recordObj.setSublistValue('item', 'tax1amt', position, 0.00);
                    recordObj.setSublistValue('item', 'grossamt', position, round2(newNetAmt));
                    recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', position, round2(netamt));
                    grossAmnt = round2(newNetAmt);

                  } else if (caseBR == 4) {

                    var totalTaxNoAddLine = calculateTaxesNoAddLine(taxNoAddLine, getItemTaxesBySubsidiary(subsidiary, caseBR, 1));

                    ///recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', position, round2(grossamt));

                    var newNetAmt = netamt + totalTaxNoAddLine;
                    var rate = parseFloat(newNetAmt) / quantity;

                    if (featureMultiPrice == true || featureMultiPrice == 'T') {
                      recordObj.setSublistValue('item', 'price', position, -1);
                    }

                    recordObj.setSublistValue('item', 'rate', position, round2(rate));
                    recordObj.setSublistValue('item', 'amount', position, round2(newNetAmt));
                    recordObj.setSublistValue('item', 'tax1amt', position, 0.00);
                    recordObj.setSublistValue('item', 'grossamt', position, round2(newNetAmt));
                    recordObj.setSublistValue('item', 'custcol_lmry_br_base_amount', position, round2(netamt));
                    recordObj.setSublistValue('item', 'custcol_lmry_br_total_impuestos', position, parseFloat(totalTaxNoAddLine));
                    grossAmnt = round2(newNetAmt);
                  }

                  for (var k = 0; k < arr_auxTR.length - 1; k++) {
                    record.submitFields({
                      type: 'customrecord_lmry_br_transaction',
                      id: parseInt(arr_auxTR[k]),
                      values: {
                        custrecord_lmry_gross_amt: grossAmnt,
                        custrecord_lmry_gross_amt_local_curr: parseFloat(parseFloat(grossAmnt) * exchangeRate)
                      },
                      options: {
                        ignoreMandatoryFields: true,
                        enableSourcing: true,
                        disableTriggers: true
                      }
                    });
                  }

                } else {

                  var taxDetailOverride = recordObj.getValue({
                    fieldId: 'taxdetailsoverride'
                  });
                  if (taxDetailOverride === "T" || taxDetailOverride === true) {

                    var grossAmnt = 0;
                    var itemReference = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: position });

                    if (caseBR === 1) {

                      var taxRate = round2(totalTaxAmount / round2(netamt));

                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: position, value: itemReference });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: position, value: taxType });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: position, value: taxCode });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: position, value: round2(netamt) });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: position, value: taxRate });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: position, value: totalTaxAmount });

                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: position, value: totalTaxAmount });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: position, value: round2(netamt) });

                      grossAmnt = grossamt;

                    } else if (caseBR === 2) {

                      var newNetAmt = parseFloat(grossamt) - parseFloat(totalTaxAmount);
                      var rate = newNetAmt / quantity;

                      if (featureMultiPrice == true || featureMultiPrice == 'T') {
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'price', line: position, value: -1 });
                      }

                      var taxRate = round2(totalTaxAmount / round2(grossamt));

                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: position, value: itemReference });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: position, value: taxType });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: position, value: taxCode });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: position, value: grossamt });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: position, value: taxRate });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: position, value: totalTaxAmount });

                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: position, value: round2(rate) });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: position, value: round2(newNetAmt) });

                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: position, value: totalTaxAmount });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: position, value: round2(grossamt) });

                      grossAmnt = grossamt;

                    } else if (caseBR === 3) {

                      var newNetAmt = netamt + totalTaxAmount;
                      var rate = parseFloat(newNetAmt) / quantity;

                      if (featureMultiPrice == true || featureMultiPrice == 'T') {
                        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'price', line: position, value: -1 });
                      }

                      var taxRate = round2(totalTaxAmount / round2(netamt));

                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: position, value: itemReference });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: position, value: taxType });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: position, value: taxCode });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: position, value: netamt });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: position, value: taxRate });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: position, value: 0.00 });

                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: position, value: round2(rate) });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: position, value: round2(newNetAmt) });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: position, value: totalTaxAmount });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: position, value: round2(netamt) });

                      grossAmnt = round2(newNetAmt);

                    } else if (caseBR === 4) {

                      var totalTaxNoAddLine = calculateTaxesNoAddLine(taxNoAddLine, getItemTaxesBySubsidiary(subsidiary, caseBR, 1));

                      var newNetAmt = netamt + totalTaxNoAddLine;
                      var rate = parseFloat(newNetAmt) / quantity;

                      if (featureMultiPrice == true || featureMultiPrice == 'T') {
                        recordObj.setSublistValue('item', 'price', position, -1);
                      }

                      var taxRate = round2(totalTaxNoAddLine / round2(netamt));

                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: position, value: itemReference });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: position, value: taxType });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: position, value: taxCode });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: position, value: netamt });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: position, value: taxRate });
                      recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: position, value: 0.00 });

                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: position, value: round2(rate) });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: position, value: round2(newNetAmt) });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: position, value: totalTaxNoAddLine });
                      recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: position, value: round2(netamt) });

                      grossAmnt = round2(newNetAmt);

                    }

                    for (var k = 0; k < arr_auxTR.length - 1; k++) {
                      record.submitFields({
                        type: 'customrecord_lmry_br_transaction',
                        id: arr_auxTR[k],
                        values: {
                          custrecord_lmry_gross_amt: grossAmnt,
                          custrecord_lmry_gross_amt_local_curr: parseFloat(parseFloat(grossAmnt) * exchangeRate)
                        },
                        options: {
                          ignoreMandatoryFields: true,
                          enableSourcing: true,
                          disableTriggers: true
                        }
                      });
                    }

                  }

                }
                // }
              } else {
                agregarTaxCalculatorBR(recordObj, idItem, exchangeRate, response, position, '', null, concatAccountBooks, merchOrig);
              }
            }
          }

          if (recordType != 'itemfulfillment') {

            var status = "2";
            if (runtime.executionContext == 'MAPREDUCE') {
              status = "4";
            }
            if (recordObj.getField({
                fieldId: "custbody_lmry_gl_status_process"
              })) {
              recordObj.setValue({
                fieldId: "custbody_lmry_gl_status_process",
                value: status
              });
            }

            if (!hasGeneratedItemTax(recordObj) && Object.keys(totalItemTaxes).length) {
              var itemTaxes = getItemTaxesBySubsidiary(subsidiary, caseBR, 2);
              if (Object.keys(itemTaxes).length) {
                for (var taxTag in totalItemTaxes) {
                  if (totalItemTaxes[taxTag] && itemTaxes[taxTag]) {
                    setItemTax(recordObj, taxTag, totalItemTaxes[taxTag], itemTaxes[taxTag], {
                      'department': depSetup,
                      'class': classSetup,
                      'location': locSetup
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    function concatenarAccountingBooks(recordObj, featureMultiBook) {
      var auxBookMB = 0;
      var auxExchangeMB = recordObj.getValue({
        fieldId: 'exchangerate'
      });

      if (featureMultiBook) {
        var lineasBook = recordObj.getLineCount({
          sublistId: 'accountingbookdetail'
        });
        if (lineasBook != null & lineasBook != '') {
          for (var j = 0; j < lineasBook; j++) {
            var lineaBook = recordObj.getSublistValue({
              sublistId: 'accountingbookdetail',
              fieldId: 'accountingbook',
              line: j
            });
            var lineaExchangeRate = recordObj.getSublistValue({
              sublistId: 'accountingbookdetail',
              fieldId: 'exchangerate',
              line: j
            });
            auxBookMB = auxBookMB + '|' + lineaBook;
            auxExchangeMB = auxExchangeMB + '|' + lineaExchangeRate;
          }
        }
      } // Fin Multibook
      return auxBookMB + '&' + auxExchangeMB;
    }

    function deleteTaxResults(recordObj) {
      if (recordObj.id) {

        var filters = [
          ['custrecord_lmry_br_transaction', 'is', recordObj.id]
        ]

        var country = recordObj.getValue('custbody_lmry_subsidiary_country');
        var type = recordObj.getValue('baserecordtype');

        //BR
        // if (Number(country) == 30 && type == 'vendorbill') {
        //     filters.push('AND', ['custrecord_lmry_created_from_script', 'is', '1']);
        // }

        var id_tax_type = '1';
        if (Number(country) == 30) {
          id_tax_type = '4';
        }
        filters.push('AND', ['custrecord_lmry_tax_type', 'anyof', id_tax_type]);

        var searchTaxResults = search.create({
          type: 'customrecord_lmry_br_transaction',
          filters: filters,
          columns: ['internalid']
        });

        var results = searchTaxResults.run().getRange(0, 1000);
        if (results) {
          for (var i = 0; i < results.length; i++) {
            var internalid = results[i].getValue('internalid');
            record.delete({
              type: 'customrecord_lmry_br_transaction',
              id: internalid
            });
          }
        }

      }
    }

    function deleteTaxLines(recordObj) {
      while (true) {

        var idxRemove = -1;
        var currentNumberLine = recordObj.getLineCount({ sublistId: 'item' });

        for (var i = currentNumberLine; i >= 0; i--) {
          var isItemTax = recordObj.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_lmry_ar_item_tributo',
            line: i
          });
          if (isItemTax || isItemTax == 'T') {
            idxRemove = i;
            break;
          }
        }

        if (idxRemove > -1) {
          recordObj.removeLine({
            sublistId: 'item',
            line: idxRemove
          });

        } else {
          break;
        }
      }
    }

    function calculateTaxesNoAddLine(totalTaxes, totalItemsAddNoLines) {
      var totalTaxesNoAddLines = 0;
      if (Object.keys(totalItemsAddNoLines).length) {
        for (var taxTag in totalTaxes) {
          if (totalTaxes[taxTag] && totalItemsAddNoLines[taxTag]) {
            totalTaxesNoAddLines = totalTaxesNoAddLines + totalTaxes[taxTag];
          }
        }
      }

      return totalTaxesNoAddLines;

    }

    function getExchangeRate(recordObj, currencySetup) {
      var exchangerate = 1;
      var featureMB = runtime.isFeatureInEffect({
        feature: "MULTIBOOK"
      });

      var featureSubs = runtime.isFeatureInEffect({
        feature: "SUBSIDIARIES"
      });

      var tran_exchangerate = recordObj.getValue({
        fieldId: 'exchangerate'
      })

      if (featureSubs && featureMB) {

        var subsidiary = recordObj.getValue('subsidiary');
        var currencySubs = search.lookupFields({
          type: 'subsidiary',
          id: subsidiary,
          columns: ['currency']
        }).currency[0].value;

        var numLines = recordObj.getLineCount({
          sublistId: 'accountingbookdetail'
        });

        var tran_exchangerate = recordObj.getValue({
          fieldId: 'exchangerate'
        });

        if (currencySetup && currencySetup != currencySubs) {
          if (numLines) {
            for (var i = 0; i < numLines; i++) {
              var currencyMB = recordObj.getSublistValue({
                sublistId: 'accountingbookdetail',
                fieldId: 'currency',
                line: i
              });

              if (currencyMB == currencySetup) {
                exchangerate = recordObj.getSublistValue({
                  sublistId: 'accountingbookdetail',
                  fieldId: 'exchangerate',
                  line: i
                });
                break;
              }
            }
          }
        } else {
          exchangerate = tran_exchangerate
        }
      } else {
        exchangerate = tran_exchangerate
      }

      return exchangerate;
    }

    function round2(num) {
      return parseFloat(Math.round(parseFloat(num) * 100) / 100);
    }

    function addItemTaxFromColumns(recordObj, numberLine) {
      var fieldFreight = recordObj.getSublistField({
        sublistId: 'item',
        fieldId: 'custcol_lmry_br_freight_val',
        line: numberLine
      });
      if (fieldFreight) {
        var freight_val = recordObj.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_lmry_br_freight_val',
          line: numberLine
        });
        totalItemTaxes['FREIGHT'] = (totalItemTaxes['FREIGHT'] || 0.00) + parseFloat((freight_val || 0.00));
        taxNoAddLine['FREIGHT'] = parseFloat((freight_val || 0.00));
      }

      if (recordObj.getSublistField({
          sublistId: 'item',
          fieldId: 'custcol_lmry_br_insurance_val',
          line: numberLine
        })) {
        var insurance_val = recordObj.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_lmry_br_insurance_val',
          line: numberLine
        });
        totalItemTaxes['INSURANCE'] = (totalItemTaxes['INSURANCE'] || 0.00) + parseFloat((insurance_val || 0.00));
        taxNoAddLine['INSURANCE'] = parseFloat((insurance_val || 0.00));
      }

      if (recordObj.getSublistField({
          sublistId: 'item',
          fieldId: 'custcol_lmry_br_expens_val',
          line: numberLine
        })) {
        var expenseVal = recordObj.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_lmry_br_expens_val',
          line: numberLine
        });
        totalItemTaxes['OTHEREXPENSES'] = (totalItemTaxes['OTHEREXPENSES'] || 0.00) + parseFloat((expenseVal || 0.00));
        taxNoAddLine['OTHEREXPENSES'] = parseFloat((expenseVal || 0.00));
      }
    }
    /**********************************************************************************************
     * Funcion que extrae valores del Response de la columna dependiendo del impuesto
     * (Tax Calculator - FE - Brasil)
     * Parámetros :
     *      recordId : ID de la transacción
     *      exchangeRate : Exchange Rate para convertir a moneda base
     *      idItemBR, rspItem, posItem, baseItemBR : ID / Response / Posicion / Monto Base del item
     **********************************************************************************************/
    function agregarTaxCalculatorBR(recordObj, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, baseItemBR, concatAccountBooks, merchOrig, dsctoItem) {
      var arr_auxiliar = [];
      var recordId = parseFloat(recordObj.id);
      rspItem = replaceXML(rspItem);
      var totalTaxCalculator = 0;
      var baseICMS = 0.00;
      taxNoAddLine = {};
      // ICMS
      var icms = rspItem.split('a:ICMS>')[1];
      if (icms != null && icms != '') {
        // Etiquetas de Exentos
        var exento1 = icms.split('a:ICMS30>')[1];
        var exento2 = icms.split('a:ICMS40>')[1];
        var exento3 = icms.split('a:ICMS60>')[1];
        var exento4 = icms.split('a:ICMS51>')[1];
        var exento5 = icms.split('a:ICMS90>')[1];
        var exentoICMSST = icms.split('a:ICMSST>')[1];
        var exICMSSN101 = icms.split('a:ICMSSN101>')[1];
        var exICMSSN102 = icms.split('a:ICMSSN102>')[1];
        var exICMSSN500 = icms.split('a:ICMSSN500>')[1];
        var exICMSSN900 = icms.split('a:ICMSSN900>')[1];

        //este impuesto puede ser exento o no, segun contenga o no estos campos.
        var isexempt = true;

        if (exento4 || exento5 || exICMSSN900) {
          var vICMS = icms.split('a:vICMS>')[1];
          var pICMS = icms.split('a:pICMS>')[1];

          if (vICMS && pICMS) {
            isexempt = false;
          }
        }

        // Si es exento va a tener una de las tres etiquetas
        if ((exento1 != null && exento1 != '') || (exento2 != null && exento2 != '') || (exento3 != null && exento3 != '') ||
          (exento4 && isexempt) || (exento5 && isexempt) || exICMSSN101 || exICMSSN102 || exICMSSN500 || (exICMSSN900 && isexempt)) {
          var baseExempt = icms.split('a:vBC>')[1];
          if (baseExempt) {
            baseExempt = baseExempt.substring(0, baseExempt.length - 2);
            baseExempt = parseFloat(Math.round(parseFloat(baseExempt) * 100) / 100);
          } else {
            baseExempt = 0.00;
          }

          var CST = icms.split('a:CST>')[1] || '';
          if (CST) {
            CST = CST.substring(0, CST.length - 2);
            // CST = '0' + CST;
            CST = merchOrig + CST;
          }

          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'ICMS', baseExempt, 0, 0, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem, CST);
          arr_auxiliar.push(idTaxRes);
        } else { // En caso contrario, no es exento
          baseICMS = icms.split('a:vBC>')[1]; // Monto Base
          if (baseICMS != null && baseICMS != '') {
            baseICMS = baseICMS.substring(0, baseICMS.length - 2);
            baseICMS = parseFloat(Math.round(parseFloat(baseICMS) * 100) / 100);
          }
          var pICMS = icms.split('a:pICMS>')[1]; // Porcentaje
          if (pICMS != null && pICMS != '') {
            pICMS = pICMS.substring(0, pICMS.length - 2);
          }

          var CST = icms.split('a:CST>')[1] || '';
          if (CST) {
            CST = CST.substring(0, CST.length - 2);
            // CST = '0' + CST;
            CST = merchOrig + CST;
          }

          var vICMS = icms.split('a:vICMS>')[1]; // Impuesto calculado
          if (vICMS != null && vICMS != '') {
            vICMS = vICMS.substring(0, vICMS.length - 2);
            vICMS = parseFloat(Math.round(parseFloat(vICMS) * 100) / 100);
            vICMS = vICMS || 0.00;
            totalTaxCalculator = parseFloat(totalTaxCalculator) + parseFloat(vICMS);
            totalTaxCalculator = parseFloat(Math.round(parseFloat(totalTaxCalculator) * 100) / 100);
            var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'ICMS', baseICMS, vICMS, pICMS, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem, CST);
            arr_auxiliar.push(idTaxRes);
          }
        }
        //<a:vICMSDeson>
        var descICMS = icms.split('a:vICMSDeson>')[1];
        if (descICMS) {
          descICMS = descICMS.substring(0, descICMS.length - 2);
          descICMS = parseFloat(Math.round(parseFloat(descICMS) * 100) / 100);
          totalItemTaxes['ICMSDESON'] = (totalItemTaxes['ICMSDESON'] || 0.00) + (descICMS || 0.00);
          taxNoAddLine['ICMSDESON'] = (descICMS || 0.00);
        }

        // ICMSST (No se consideran exentos)
        var baseICMSST = icms.split('a:vBCST>')[1]; // Monto Base
        if (baseICMSST != null && baseICMSST != '') {
          baseICMSST = baseICMSST.substring(0, baseICMSST.length - 2);
          baseICMSST = parseFloat(Math.round(parseFloat(baseICMSST) * 100) / 100);
        }
        var pICMSST = icms.split('a:pICMSST>')[1]; // Porcentaje
        if (pICMSST != null && pICMSST != '') {
          pICMSST = pICMSST.substring(0, pICMSST.length - 2);
        }
        var vICMSST = icms.split('a:vICMSST>')[1]; // Impuesto calculado
        if (vICMSST != null && vICMSST != '') {
          vICMSST = vICMSST.substring(0, vICMSST.length - 2);
          vICMSST = parseFloat(Math.round(parseFloat(vICMSST) * 100) / 100);
          vICMSST = vICMSST || 0.00;
          //totalTaxCalculator = parseFloat(totalTaxCalculator) + parseFloat(vICMSST);
          //totalTaxCalculator = parseFloat(Math.round(parseFloat(totalTaxCalculator) * 100) / 100);
          totalItemTaxes['ICMSST'] = (totalItemTaxes['ICMSST'] || 0.00) + vICMSST;
          taxNoAddLine['ICMSST'] = vICMSST;
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'ICMSST', baseICMSST, vICMSST, pICMSST, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        }

        if (exentoICMSST) {
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'ICMSST', 0.00, 0, 0, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        }

        var vFCPST = icms.split('a:vFCPST>')[1];
        if (vFCPST) {
          vFCPST = vFCPST.substring(0, vFCPST.length - 2);
          vFCPST = round2(vFCPST);
          vFCPST = vFCPST || 0.00;
          totalItemTaxes['FCPST'] = (totalItemTaxes['FCPST'] || 0.00) + vFCPST;
          taxNoAddLine['FCPST'] = vFCPST;
        }

        var baseFCP = baseICMS || 0.00;

        // FCP
        var pFCP = icms.split('a:pFCP>')[1] || 0.00;
        if (pFCP) {
          pFCP = pFCP.substring(0, pFCP.length - 2);
          pFCP = parseFloat(pFCP);
        }

        var vFCP = icms.split('a:vFCP>')[1] || 0.00;
        if (vFCP) {
          vFCP = vFCP.substring(0, vFCP.length - 2);
          vFCP = round2(vFCP);
          vFCP = vFCP || 0.00;
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'FCP', baseFCP, vFCP, pFCP, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        }
      }

      // IPI
      var ipi = rspItem.split('a:IPI>')[1];
      if (ipi != null && ipi != '') {
        // Etiquetas de Exentos
        var exento2 = ipi.split('a:IPINT>')[1];
        // Si es exento va a tener una de las dos etiquetas
        if ((exento2 != null && exento2 != '')) {
          var baseExempt = ipi.split('a:vBC>')[1];
          if (baseExempt) {
            baseExempt = baseExempt.substring(0, baseExempt.length - 2);
            baseExempt = parseFloat(Math.round(parseFloat(baseExempt) * 100) / 100);
          } else {
            baseExempt = 0.00;
          }

          var CST = ipi.split('a:CST>')[1] || '';
          if (CST) {
            CST = CST.substring(0, CST.length - 2);
          }

          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'IPI', baseExempt, 0, 0, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem, CST);
          arr_auxiliar.push(idTaxRes);
        } else { // En caso contrario, no es exento
          var baseIPI = ipi.split('a:vBC>')[1]; // Monto Base
          if (baseIPI != null && baseIPI != '') {
            baseIPI = baseIPI.substring(0, baseIPI.length - 2);
            baseIPI = parseFloat(Math.round(parseFloat(baseIPI) * 100) / 100);
          } else {
            baseIPI = 0.00;
          }
          var pIPI = ipi.split('a:pIPI>')[1]; // Porcentaje
          if (pIPI != null && pIPI != '') {
            pIPI = pIPI.substring(0, pIPI.length - 2);
          }

          var CST = ipi.split('a:CST>')[1] || '';
          if (CST) {
            CST = CST.substring(0, CST.length - 2);
          }

          var vIPI = ipi.split('a:vIPI>')[1]; // Impuesto calculado
          if (vIPI != null && vIPI != '') {
            vIPI = vIPI.substring(0, vIPI.length - 2);
            vIPI = parseFloat(Math.round(parseFloat(vIPI) * 100) / 100);
            vIPI = vIPI || 0.00;
            //totalTaxCalculator = parseFloat(totalTaxCalculator) + parseFloat(vIPI);
            //totalTaxCalculator = parseFloat(Math.round(parseFloat(totalTaxCalculator) * 100) / 100);

            totalItemTaxes['IPI'] = (totalItemTaxes['IPI'] || 0.00) + vIPI;
            taxNoAddLine['IPI'] = vIPI;
            var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'IPI', baseIPI, vIPI, pIPI, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem, CST);
            arr_auxiliar.push(idTaxRes);
          }
        }
      }

      // PIS
      var pis = rspItem.split('a:PIS>')[1];
      if (pis != null && pis != '') {
        // Etiquetas de Exentos
        var exento2 = pis.split('a:PISNT>')[1];
        // Si es exento va a tener una de las dos etiquetas
        if (exento2 != null && exento2 != '') {
          var baseExempt = pis.split('a:vBC>')[1];
          if (baseExempt) {
            baseExempt = baseExempt.substring(0, baseExempt.length - 2);
            baseExempt = parseFloat(Math.round(parseFloat(baseExempt) * 100) / 100);
          } else {
            baseExempt = 0.00;
          }
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'PIS', baseExempt, 0, 0, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        } else { // En caso contrario, no es exento
          var basePIS = pis.split('a:vBC>')[1]; // Monto Base
          if (basePIS != null && basePIS != '') {
            basePIS = basePIS.substring(0, basePIS.length - 2);
            basePIS = parseFloat(Math.round(parseFloat(basePIS) * 100) / 100);
          } else {
            basePIS = 0.00;
          }
          var pPIS = pis.split('a:pPIS>')[1]; // Porcentaje
          if (pPIS != null && pPIS != '') {
            pPIS = pPIS.substring(0, pPIS.length - 2);
          } else {
            var aliq = pis.split('a:vAliqProd>')[1];
            pPIS = parseFloat(aliq.substring(0, aliq.length - 2)) * 100;
          }

          var vPIS = pis.split('a:vPIS>')[1]; // Impuesto calculado
          if (vPIS != null && vPIS != '') {
            vPIS = vPIS.substring(0, vPIS.length - 2);
            vPIS = parseFloat(Math.round(parseFloat(vPIS) * 100) / 100);
            vPIS = vPIS || 0.00;
            totalTaxCalculator = parseFloat(totalTaxCalculator) + parseFloat(vPIS);

            totalTaxCalculator = parseFloat(Math.round(parseFloat(totalTaxCalculator) * 100) / 100);
            var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'PIS', basePIS, vPIS, pPIS, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
            arr_auxiliar.push(idTaxRes);
          }
        }
      }

      // COFINS
      var cofins = rspItem.split('a:COFINS>')[1];
      if (cofins != null && cofins != '') {
        // Etiquetas de Exentos
        var exento2 = cofins.split('a:COFINSNT>')[1];
        // Si es exento va a tener una de las dos etiquetas
        if (exento2 != null && exento2 != '') {
          var baseExempt = cofins.split('a:vBC>')[1];
          if (baseExempt) {
            baseExempt = baseExempt.substring(0, baseExempt.length - 2);
            baseExempt = parseFloat(Math.round(parseFloat(baseExempt) * 100) / 100);
          } else {
            baseExempt = 0.00;
          }
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'COFINS', baseExempt, 0, 0, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        } else { // En caso contrario, no es exento
          var baseCOFINS = cofins.split('a:vBC>')[1]; // Monto Base
          if (baseCOFINS != null && baseCOFINS != '') {
            baseCOFINS = baseCOFINS.substring(0, baseCOFINS.length - 2);
            baseCOFINS = parseFloat(Math.round(parseFloat(baseCOFINS) * 100) / 100);
          } else {
            baseCOFINS = 0.00;
          }
          var pCOFINS = cofins.split('a:pCOFINS>')[1]; // Porcentaje
          if (pCOFINS != null && pCOFINS != '') {
            pCOFINS = pCOFINS.substring(0, pCOFINS.length - 2);
          } else {
            var aliq = cofins.split('a:vAliqProd>')[1];
            pCOFINS = parseFloat(aliq.substring(0, aliq.length - 2)) * 100;
          }

          var vCOFINS = cofins.split('a:vCOFINS>')[1]; // Impuesto calculado
          if (vCOFINS != null && vCOFINS != '') {
            vCOFINS = vCOFINS.substring(0, vCOFINS.length - 2);
            vCOFINS = parseFloat(Math.round(parseFloat(vCOFINS) * 100) / 100);
            vCOFINS = vCOFINS || 0.00;
            totalTaxCalculator = parseFloat(totalTaxCalculator) + parseFloat(vCOFINS);
            totalTaxCalculator = parseFloat(Math.round(parseFloat(totalTaxCalculator) * 100) / 100);
            var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'COFINS', baseCOFINS, vCOFINS, pCOFINS, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
            arr_auxiliar.push(idTaxRes);
          }
        }
      }

      var pisst = rspItem.split('a:PISST>')[1];
      if (pisst) {
        var basepisst = pisst.split('a:vBC>')[1];
        if (basepisst) {
          basepisst = basepisst.substring(0, basepisst.length - 2);
          basepisst = parseFloat(Math.round(parseFloat(basepisst) * 100) / 100);
        } else {
          basepisst = 0.00;
        }
        //a:pPIS
        var ppis = pisst.split('a:pPIS>')[1]; // Porcentaje
        if (ppis) {
          ppis = ppis.substring(0, ppis.length - 2);
        } else {
          var aliq = pisst.split('a:vAliqProd>')[1];
          ppis = parseFloat(aliq.substring(0, aliq.length - 2)) * 100;
        }
        //a:vPIS
        var vpis = pisst.split('a:vPIS>')[1]; //impuesto
        if (vpis) {
          vpis = vpis.substring(0, vpis.length - 2);
          vpis = parseFloat(Math.round(parseFloat(vpis) * 100) / 100);
          vpis = vpis || 0.00;
          totalTaxCalculator = parseFloat(totalTaxCalculator) + parseFloat(vpis);
          totalTaxCalculator = parseFloat(Math.round(parseFloat(totalTaxCalculator) * 100) / 100);
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'PISST', basepisst, vpis, ppis, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        }
      }

      var cofinsst = rspItem.split('a:COFINSST>')[1];
      if (cofinsst) {
        var basecofinsst = cofinsst.split('a:vBC>')[1];
        if (basecofinsst) {
          basecofinsst = basecofinsst.substring(0, basecofinsst.length - 2);
          basecofinsst = parseFloat(Math.round(parseFloat(basecofinsst) * 100) / 100);
        } else {
          basecofinsst = 0.00;
        }

        var pCOFINS = cofinsst.split('a:pCOFINS>')[1]; // Porcentaje
        if (pCOFINS) {
          pCOFINS = pCOFINS.substring(0, pCOFINS.length - 2);
        } else {
          var aliq = cofinsst.split('a:vAliqProd>')[1];
          pCOFINS = parseFloat(aliq.substring(0, aliq.length - 2)) * 100;
        }
        //a:vPIS
        var vCOFINS = cofinsst.split('a:vCOFINS>')[1]; //impuesto
        if (vCOFINS) {
          vCOFINS = vCOFINS.substring(0, vCOFINS.length - 2);
          vCOFINS = parseFloat(Math.round(parseFloat(vCOFINS) * 100) / 100);
          vCOFINS = vCOFINS || 0.00;
          totalTaxCalculator = parseFloat(totalTaxCalculator) + parseFloat(vCOFINS);
          totalTaxCalculator = parseFloat(Math.round(parseFloat(totalTaxCalculator) * 100) / 100);
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'COFINSST', basecofinsst, vCOFINS, pCOFINS, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        }
      }


      //ICMSUFDest
      var icmsufdest = rspItem.split('a:ICMSUFDest>')[1];
      if (icmsufdest) {
        var baseICMSUFDest = icmsufdest.split('a:vBCUFDest>')[1];
        if (baseICMSUFDest) {
          baseICMSUFDest = baseICMSUFDest.substring(0, baseICMSUFDest.length - 2);
          baseICMSUFDest = round2(baseICMSUFDest);
        } else {
          baseICMSUFDest = 0.00;
        }

        var pICMSUFDest = icmsufdest.split('a:pICMSUFDest>')[1] || 0.00;
        var pICMSInter = icmsufdest.split('a:pICMSInter>')[1] || 0.00;
        if (pICMSUFDest) {
          pICMSUFDest = pICMSUFDest.substring(0, pICMSUFDest.length - 2);
          pICMSUFDest = parseFloat(pICMSUFDest);
        }

        if (pICMSInter) {
          pICMSInter = pICMSInter.substring(0, pICMSInter.length - 2);
          pICMSInter = parseFloat(pICMSInter);
        }

        var dICMSUFDest = pICMSUFDest - pICMSInter;

        if (dICMSUFDest < 0) {
          dICMSUFDest = 0.00;
        }

        var vICMSUFDest = icmsufdest.split('a:vICMSUFDest>')[1] || 0.00;
        if (vICMSUFDest) {
          vICMSUFDest = vICMSUFDest.substring(0, vICMSUFDest.length - 2);
          vICMSUFDest = round2(vICMSUFDest);
          vICMSUFDest = vICMSUFDest || 0.00;
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'ICMSUFDest', baseICMSUFDest, vICMSUFDest, dICMSUFDest, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        }


        //FCPUFDest
        var baseCUFDest = icmsufdest.split('a:vBCUFDest>')[1];
        if (baseCUFDest) {
          baseCUFDest = baseCUFDest.substring(0, baseCUFDest.length - 2);
          baseCUFDest = round2(baseCUFDest);
        } else {
          baseCUFDest = 0.00;
        }

        var pFCPUFDest = icmsufdest.split('a:pFCPUFDest>')[1] || 0.00;
        if (pFCPUFDest) {
          pFCPUFDest = pFCPUFDest.substring(0, pFCPUFDest.length - 2);
          pFCPUFDest = parseFloat(pFCPUFDest);
        }


        var vFCPUFDest = icmsufdest.split('a:vFCPUFDest>')[1];
        if (vFCPUFDest) {
          vFCPUFDest = vFCPUFDest.substring(0, vFCPUFDest.length - 2);
          vFCPUFDest = round2(vFCPUFDest);
          vFCPUFDest = vFCPUFDest || 0.00;
          var idTaxRes = agregarTaxCalculator_TaxResults(parseFloat(recordId), 'FCP', baseCUFDest, vFCPUFDest, pFCPUFDest, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem);
          arr_auxiliar.push(idTaxRes);
        }

      }
      var _total = Math.round(parseFloat(totalTaxCalculator) * 100) / 100;
      arr_auxiliar.push(_total);
      return arr_auxiliar
      // return parseFloat(Math.round(parseFloat(totalTaxCalculator) * 100) / 100);
    }

    function agregarTaxCalculator_TaxResults(idTransBR, subtipoBR, baseBR, retencBR, percentBR, idItemBR, exchangeRate, rspItem, posItem, lineUniqueKey, concatAccountBooks, dsctoItem, situationCode) {
      var recordTaxCalculator = record.create({
        type: 'customrecord_lmry_br_transaction',
        isDynamic: false
      });
      idTransBR = idTransBR + "";
      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_br_related_id',
        value: idTransBR
      });
      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_br_transaction',
        value: idTransBR
      });

      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_tax_type',
        value: '4' //Calculo de impuesto
      });

      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_br_type',
        value: subtipoBR
      });

      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_base_amount',
        value: baseBR
      });

      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_br_total',
        value: retencBR
      });
      if (percentBR != '' && percentBR != null) {
        recordTaxCalculator.setValue({
          fieldId: 'custrecord_lmry_br_percent',
          value: parseFloat(parseFloat(percentBR) / 100)
        });
      }
      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_total_item',
        value: 'Tax Calculator'
      });
      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_item',
        value: idItemBR
      });
      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_total_base_currency',
        value: parseFloat(parseFloat(retencBR) * exchangeRate)
      });
      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_amount_local_currency',
        value: parseFloat(parseFloat(retencBR) * exchangeRate)
      });
      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_br_taxcalc_rsp',
        value: rspItem
      });
      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_br_positem',
        value: parseInt(posItem)
      });

      if (recordTaxCalculator.getField({
          fieldId: 'custrecord_lmry_lineuniquekey'
        })) {
        recordTaxCalculator.setValue({
          fieldId: 'custrecord_lmry_lineuniquekey',
          value: lineUniqueKey
        });
      }

      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_accounting_books',
        value: concatAccountBooks
      });

      recordTaxCalculator.setValue({
        fieldId: 'custrecord_lmry_base_amount_local_currc',
        value: parseFloat(parseFloat(baseBR) * exchangeRate)
      });

      if (situationCode) {
        recordTaxCalculator.setValue({
          fieldId: 'custrecord_lmry_br_tax_taxsituation_cod',
          value: situationCode
        });
      }

      if (dsctoItem) {
        recordTaxCalculator.setValue({
          fieldId: 'custrecord_lmry_discount_amt',
          value: dsctoItem
        });

        recordTaxCalculator.setValue({
          fieldId: 'custrecord_lmry_discount_amt_local_curr',
          value: parseFloat(parseFloat(dsctoItem) * exchangeRate)
        });
      }

      var idTaxResult = recordTaxCalculator.save({
        enableSourcing: true,
        ignoreMandatoryFields: true
      });

      return idTaxResult;

    }

    function hasGeneratedItemTax(recordObj) {
      var numLines = recordObj.getLineCount({
        sublistId: 'item'
      });
      var hasItemTax = false;
      for (var i = 0; i < numLines; i++) {
        var isItemTax = recordObj.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_lmry_ar_item_tributo',
          line: i
        });
        if (isItemTax) {
          hasItemTax = true;
          break;
        }
      }
      return hasItemTax;
    }

    function getItemTaxesBySubsidiary(idSubsidiary, caseBR, type) {
      var resultItemTaxes = {};
      var orFilters = [];
      var filters = [];


      for (var taxTag in totalItemTaxes) {
        orFilters.push(['custrecord_lmry_br_config_itx_tax_tag', 'startswith', taxTag], 'OR');
      }

      orFilters.pop();


      if (caseBR == 4) {
        if (type == 1) {
          filters.push(['custrecord_lmry_br_config_itx_no_addline', 'is', 'T'], 'AND');
        } else {
          filters.push(['custrecord_lmry_br_config_itx_no_addline', 'is', 'F'], 'AND');
        }
      }

      filters.push(
        ['isinactive', 'is', 'F'], 'AND',
        ['custrecord_lmry_br_config_itx_subsidiary', 'anyof', idSubsidiary], 'AND',
        orFilters
      );


      var search_itemTaxes = search.create({
        type: 'customrecord_lmry_br_config_item_tax',
        filters: filters,
        columns: [
          'custrecord_lmry_br_config_itx_tax_tag', 'custrecord_lmry_br_config_itx_item',
          'custrecord_lmry_br_config_itx_tax_code', 'custrecord_lmry_br_config_itx_is_exoner'
        ]
      });

      var results = search_itemTaxes.run().getRange(0, 1000);
      var columns = search_itemTaxes.columns;

      if (results && results.length) {
        for (var i = 0; i < results.length; i++) {
          var taxTag = results[i].getValue(columns[0]).trim().toUpperCase();
          if (taxTag) {
            resultItemTaxes[taxTag] = {};
            resultItemTaxes[taxTag]['item'] = results[i].getValue(columns[1]);
            resultItemTaxes[taxTag]['taxCode'] = results[i].getValue(columns[2]);
            resultItemTaxes[taxTag]['isExoner'] = results[i].getValue(columns[3]);
          }
        }
      }
      return resultItemTaxes;
    }

    function setItemTax(recordObj, taxTag, taxValue, objItemTax, segmentacion) {
      var idItemTax = objItemTax['item'];
      var taxCode = objItemTax['taxCode'];
      var isExoner = objItemTax['isExoner'];

      if (idItemTax && taxCode) {
        var numLines = recordObj.getLineCount('item');
        recordObj.insertLine({
          sublistId: 'item',
          line: numLines
        });
        recordObj.setSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: numLines,
          value: idItemTax
        });
        recordObj.setSublistValue({
          sublistId: 'item',
          fieldId: 'quantity',
          line: numLines,
          value: 1
        });
        if (isExoner) {
          taxValue = -1 * taxValue;
        }
        recordObj.setSublistValue({
          sublistId: 'item',
          fieldId: 'rate',
          line: numLines,
          value: taxValue
        });
        recordObj.setSublistValue({
          sublistId: 'item',
          fieldId: 'taxcode',
          line: numLines,
          value: taxCode
        });

        var description = taxTag + ' (Tax Calculator) ';
        recordObj.setSublistValue({
          sublistId: 'item',
          fieldId: 'description',
          line: numLines,
          value: description
        });

        recordObj.setSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_lmry_ar_item_tributo',
          line: numLines,
          value: true
        });
        //recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: numLines, value: baseamount });
        //recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_base_amount', line: numLines, value: baseamount });

        var featDep = runtime.isFeatureInEffect({
          feature: "DEPARTMENTS"
        });
        var featLoc = runtime.isFeatureInEffect({
          feature: "LOCATIONS"
        });
        var featClass = runtime.isFeatureInEffect({
          feature: "CLASSES"
        });
        var userObj = runtime.getCurrentUser();
        var deptMandatory = userObj.getPreference({
          name: "DEPTMANDATORY"
        });
        var locMandatory = userObj.getPreference({
          name: "LOCMANDATORY"
        });
        var classMandatory = userObj.getPreference({
          name: "CLASSMANDATORY"
        });

        if (featDep) {
          if (deptMandatory) {
            var department = segmentacion['department'];
            if (!department) {
              department = recordObj.getValue({
                fieldId: 'department'
              });
            }
            recordObj.setSublistValue({
              sublistId: 'item',
              fieldId: 'department',
              line: numLines,
              value: department
            });
          }
        }

        if (featClass) {
          if (classMandatory) {
            var class_ = segmentacion['class'];
            if (!class_) {
              var class_ = recordObj.getValue({
                fieldId: 'class'
              });
            }
            recordObj.setSublistValue({
              sublistId: 'item',
              fieldId: 'class',
              line: numLines,
              value: class_
            });
          }
        }

        var fieldLocation = recordObj.getSublistField({
          sublistId: 'item',
          fieldId: 'location',
          line: numLines
        });
        if (featLoc && fieldLocation) {
          if (locMandatory) {
            var location = segmentacion['location'];
            if (!location) {
              location = recordObj.getValue({
                fieldId: 'location'
              });
            }
            recordObj.setSublistValue({
              sublistId: 'item',
              fieldId: 'location',
              line: numLines,
              value: location
            });
          }
        }

      }
    }

    function replaceXML(xml) {
      xml = xml.replace(/</g, '<');
      xml = xml.replace(/>/g, '>');
      xml = xml.replace(/&lt;/g, '<');
      xml = xml.replace(/&gt;/g, '>');
      return xml;
    }

    return {
      SendTaxCalcRsp: SendTaxCalcRsp,
      deleteTaxLines: deleteTaxLines,
      deleteTaxResults: deleteTaxResults
    }

  });
