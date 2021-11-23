/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */
/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ST_TAX_Withholding_LBRY_V2.0.js		          ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Nov 25 2019  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
define(['N/log', 'N/record', 'N/search', 'N/runtime', 'N/error', 'N/format', '../Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
  function(log, record, search, runtime, error, format, library_mail) {
    var LMRY_script = 'LatamTax ST Withholding BR LBRY';
    var TAX_TYPE = 1;
    var GEN_TRANSACTION = 6;
    var featureSubs = false;
    var FEAT_MULTIBOOK = false;
    var FEAT_INSTALLMENTS = false;
    var CONFIG_TRANSACTION = {
      'invoice': {
        'recordtype': 'creditmemo',
        "form": "creditmemoform"
      },
      'creditmemo': {
        'recordtype': 'invoice',
        "form": "invoiceform"
      },
    };

    var FEATURE_TRANSACTION = {
      'invoice': 'CUSTOMAPPROVALCUSTINVC',
    };

    var TRANSACTIONS = {
      'invoice': 1,
      'creditmemo': 8
    };
    var MEMO_TRANSACTION = '(LatamTax -  WHT)';
    var MEMO_LINE = ' (LatamTax - WHT) ';
    var WHT_MEMO = 'Latam - WHT Tax';

    var language = runtime.getCurrentScript().getParameter({
      name: 'LANGUAGE'
    });
    language = language.substring(0, 2);

    function LatamTaxWithHoldingBR(recordObj, type) {
      try {
        var typeTransaction = recordObj.getValue('baserecordtype');
        var transactionID = recordObj.id;
        var country = recordObj.getValue({
          fieldId: 'custbody_lmry_subsidiary_country'
        });

        if (Number(country) == 30) { //BR
          GEN_TRANSACTION = 6;
          //Si no esta anulado
          if (recordObj.getValue('voided') != 'T') {

            if (typeTransaction == "creditmemo") {
              deleteTaxResults(recordObj.id);
            }

            var TOTAL_AMOUNT_WHT = 0.00;
            var subsidiary = recordObj.getValue({
              fieldId: 'custbody_lmry_subsidiary_country'
            });

            featureSubs = runtime.isFeatureInEffect({
              feature: "SUBSIDIARIES"
            });

            FEAT_MULTIBOOK = runtime.isFeatureInEffect({
              feature: "MULTIBOOK"
            });

            if (featureSubs == true || featureSubs == 'T') {
              subsidiary = recordObj.getValue({
                fieldId: 'subsidiary'
              });
            }
            //Feature Approval Status Invoice
            var approvalFeature = false;

            if (FEATURE_TRANSACTION[typeTransaction]) {
              approvalFeature = runtime.getCurrentScript().getParameter({
                name: FEATURE_TRANSACTION[typeTransaction]
              });
            }

            var approvalStatus = recordObj.getValue({
              fieldId: 'approvalstatus'
            });
            var selectedAppliesTo = recordObj.getValue({
              fieldId: 'custbody_lmry_wht_appliesto'
            });
            if (selectedAppliesTo || Number(selectedAppliesTo) > 0) {
              if ((approvalFeature == false || approvalFeature == 'F') || ((approvalFeature == true || approvalFeature == 'T') && (approvalStatus && Number(approvalStatus) == 2))) {
                if (!checkWithholdingTax(recordObj)) {
                  log.error("[typeTransaction, transactionID]", [typeTransaction, transactionID]);
                  var customSegments = getCustomSegments();
                  log.error("customSegments", JSON.stringify(customSegments));
                  var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
                  log.error("setupSubsidiary", JSON.stringify(setupSubsidiary));
                  var validationsTaxes = getValidationsBRTaxes(recordObj, setupSubsidiary);
                  log.error('validationsTaxes', JSON.stringify(validationsTaxes));
                  var taxGroups = getTaxGroups(subsidiary);
                  log.error('taxGroups', JSON.stringify(taxGroups));

                  if (taxGroups && Object.keys(taxGroups).length) {
                    var taxResults = getWhtTaxResults(recordObj, subsidiary, setupSubsidiary, validationsTaxes, taxGroups);

                    var validatedWHTs = getValidatedWithholdings(taxResults, selectedAppliesTo, taxGroups);

                    var strAccountingBooks = concatAccountingBooks(recordObj);

                    log.error('validatedWHTs', JSON.stringify(validatedWHTs));
                    var notExceedTotal = validateTotalWHT(recordObj, validatedWHTs);
                    if (notExceedTotal && validatedWHTs.length) {
                      for (var i = 0; i < validatedWHTs.length; i++) {
                        if (validatedWHTs[i]) {
                          saveTaxResult(recordObj.id, validatedWHTs[i], strAccountingBooks);
                        }
                      }

                      FEAT_INSTALLMENTS = runtime.isFeatureInEffect({
                        feature: "installments"
                      });
                      var installments = {};
                      if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == "T") {
                        if (typeTransaction == "invoice") {
                          updateInstallments(recordObj, validatedWHTs, installments);
                        }
                      }

                      var idRecordWHT = createWHTTransaction(recordObj, validatedWHTs, setupSubsidiary, customSegments, installments);

                      if (idRecordWHT) {
                        TOTAL_AMOUNT_WHT = search.lookupFields({
                          type: CONFIG_TRANSACTION[typeTransaction]['recordtype'],
                          id: idRecordWHT,
                          columns: ["fxamount"]
                        }).fxamount || 0.00;
                      }

                      if (typeTransaction == "creditmemo") {
                        //Para credit memo, se edita la transaccion y se agrega el wht invoice.
                        applyTransaction(recordObj, idRecordWHT, TOTAL_AMOUNT_WHT);
                      }

                    }
                    record.submitFields({
                      type: typeTransaction,
                      id: transactionID,
                      values: {
                        'custbody_lmry_wtax_amount': Math.abs(parseFloat(TOTAL_AMOUNT_WHT)),
                        'custbody_lmry_wtax_code_des': WHT_MEMO
                      },
                      options: {
                        disableTriggers: true
                      }
                    });

                    if (!notExceedTotal) {
                      var errorObj = error.create({
                        name: 'WHT_TOTAL_AMOUNT_EXCEEDS',
                        message: "The total amount of withholdings exceeds the total amount of the transaction.",
                        notifyOff: false
                      });
                      throw errorObj;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        library_mail.sendemail('[ LatamTaxWithHoldingBR ] ' + err, LMRY_script);
      }

      return recordObj;
    }


    function getValidatedWithholdings(taxResultGroups, selectedAppliesTo, taxGroups) {
      var validatedWHTs = [];
      for (var group in taxResultGroups) {
        var minimWHT = parseFloat(taxGroups[group]['minim']);
        var taxResults = taxResultGroups[group];
        var totalGroup = 0.00;
        var taxResultsByGroup = [];
        for (var key in taxResults) {
          for (var i = 0; i < taxResults[key].length; i++) {
            var taxResult = taxResults[key][i];
            if (taxResult) {
              totalGroup += round2(taxResult['amount']);
            }
          }
          taxResultsByGroup = taxResultsByGroup.concat(taxResults[key]);
        }

        if (minimWHT <= totalGroup) {
          validatedWHTs = validatedWHTs.concat(taxResultsByGroup);
        }
      }
      return validatedWHTs;
    }


    function getWhtTaxResults(recordObj, subsidiary, setupSubsidiary, validationsTaxes, taxGroups) {
      var taxResults = {};
      var selectedAppliesTo = recordObj.getValue('custbody_lmry_wht_appliesto');
      var exchangeRate = getExchangeRate(recordObj, setupSubsidiary['currency']);
      var taxRecords = getContributoryClasses(recordObj, subsidiary, taxGroups);
      log.error('ccs', JSON.stringify(taxRecords));

      var numberCclasses = taxRecords['total'].length;

      if (Number(selectedAppliesTo) == 2) {
        numberCclasses = Object.keys(taxRecords['item']).length || Object.keys(taxRecords['catalog']).length;
      }

      if (!numberCclasses) {
        taxRecords = getNationalTaxes(recordObj, subsidiary, taxGroups);
        log.error('nts', JSON.stringify(taxRecords));
      }

      if (Number(selectedAppliesTo) == 1) {
        if (taxRecords['total'] && taxRecords['total'].length) {
          if (validationsTaxes['total']) {
            var totalAmounts = getTotalAmounts(recordObj);
            calculateWHTTaxResults({
                'grossAmt': totalAmounts["total"],
                'taxAmt': totalAmounts["taxTotal"],
                'netAmt': totalAmounts["subTotal"]
              },
              taxRecords['total'], '', '', '', exchangeRate, taxResults);
          }
        }
      } else if (Number(selectedAppliesTo) == 2) {

        var numLines = recordObj.getLineCount({
          sublistId: 'item'
        });

        if (numLines) {

          var discountAmounts = getDiscountAmounts(recordObj);
          log.error("discountAmounts", JSON.stringify(discountAmounts));

          for (var i = 0; i < numLines; i++) {
            if (validationsTaxes[String(i)]) {
              var apply_wht_field = recordObj.getSublistField({
                sublistId: 'item',
                fieldId: 'custcol_lmry_apply_wht_tax',
                line: i
              });
              if (apply_wht_field) {
                var applywht_ischeck = recordObj.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_lmry_apply_wht_tax',
                  line: i
                });
                if (applywht_ischeck == true || applywht_ischeck == 'T') {
                  var isTaxItem = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_lmry_ar_item_tributo',
                    line: i
                  });
                  var typeDiscount = recordObj.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_lmry_col_sales_type_discount',
                    line: i
                  });

                  if ((isTaxItem != true && isTaxItem != 'T') && !typeDiscount) {
                    var netAmt = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'amount',
                      line: i
                    });
                    netAmt = parseFloat(netAmt);

                    var taxAmt = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'taxamount',
                      line: i
                    }) || 0;
                    taxAmt = parseFloat(taxAmt);

                    var grossAmt = round2(netAmt + taxAmt);

                    var catalog = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'custcol_lmry_br_service_catalog',
                      line: i
                    });
                    var item = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'item',
                      line: i
                    });
                    var lineUniqueKey = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'lineuniquekey',
                      line: i
                    });
                    var discountAmt = discountAmounts[String(i)] || 0.00;

                    var amounts = {
                      'grossAmt': grossAmt,
                      'taxAmt': taxAmt,
                      'netAmt': netAmt,
                      "discAmt": discountAmt
                    };
                    //Caso Servicios
                    if (catalog) {
                      catalog = String(catalog);
                      calculateWHTTaxResults(amounts, taxRecords['catalog'][catalog], i, item, lineUniqueKey, exchangeRate, taxResults);
                    } else {
                      item = String(item);
                      calculateWHTTaxResults(amounts, taxRecords['item'][item], i, item, lineUniqueKey, exchangeRate, taxResults);
                    }
                  }
                }
              }
            }
          }
        }
      }
      return taxResults;
    }

    function calculateWHTTaxResults(objAmounts, taxRecords, position, idItem, lineUniqueKey, exchangeRate, totalTaxResults) {
      if (taxRecords && taxRecords.length) {
        var grossAmt = objAmounts['grossAmt'];
        var netAmt = objAmounts['netAmt'];
        var taxAmt = objAmounts['taxAmt'];
        var discAmt = parseFloat(objAmounts["discAmt"]) || 0.00;
        log.error("objAmounts", JSON.stringify(objAmounts));

        for (var i = 0; i < taxRecords.length; i++) {
          var taxRecord = taxRecords[i];
          var baseAmount = 0.00;
          var amountTo = Number(taxRecord['amountTo']);

          if (amountTo == 1) {
            baseAmount = round2(parseFloat(grossAmt) - discAmt);
          } else if (amountTo == 2) {
            baseAmount = parseFloat(taxAmt);
          } else if (amountTo == 3) {
            baseAmount = round2(parseFloat(netAmt) - discAmt);
          }
          baseAmount = baseAmount - taxRecord['notTaxableMin'] / exchangeRate;
          var compareAmount = baseAmount;
          var how_base_amount = Number(taxRecord['baseAmount']);
          var minAmt = parseFloat(taxRecord['minim']) / exchangeRate;
          var maxAmt = parseFloat(taxRecord['maxim']) / exchangeRate;

          if (how_base_amount) {
            if (how_base_amount == 2 || how_base_amount == 5) {
              baseAmount = baseAmount - minAmt;
            } else if (how_base_amount == 3) {
              baseAmount = minAmt
            } else if (how_base_amount == 4) {
              baseAmount = maxAmt;
            }
          }
          // log.error('internalid', taxRecord['internalid']);
          // log.error('[baseAmount, compareAmount, how_base_amount]', [baseAmount, compareAmount, how_base_amount].join('-'));
          // log.error('[minAmt, maxAmt,exchangeRate]', [minAmt, maxAmt, exchangeRate].join('-'));


          if (minAmt <= compareAmount && ((compareAmount <= maxAmt) || !maxAmt)) {
            if (baseAmount > 0) {
              var taxRate = parseFloat(taxRecord['rate']);
              var ratio = parseFloat(taxRecord['ratio']);
              var baseRetention = parseFloat(taxRecord['baseRetention']);
              var amount = (baseAmount * ratio * taxRate) + (baseRetention / exchangeRate);

              //var roundedAmount = roundSetup(amount, roundingType);
              //var roundedAmount = round4(amount);

              var TYPE_TAX_RESULT = {
                '1': 'Total',
                '2': 'Line - Item'
              };

              var taxResult = {
                'appliesto': taxRecord['appliesto'],
                'subtype': taxRecord['subtype'],
                'subtypeid': taxRecord['subtypeid'],
                'baseAmount': baseAmount,
                'fxamount': amount, //Moneda de la transaccion
                'amount': round2(amount) * exchangeRate,
                'taxRate': parseFloat(taxRecord['rate']),
                'type': TYPE_TAX_RESULT[String(taxRecord['appliesto'])],
                'idItem': idItem,
                'position': position,
                'typeRecord': taxRecord['typeRecord'],
                'idRecord': taxRecord['internalid'],
                'receita': taxRecord['receita'],
                // 'taxSituation': taxRecord['taxSituation'],
                // 'natureRevenue': taxRecord['natureRevenue'],
                'deparment': taxRecord['department'],
                'class': taxRecord['class'],
                'location': taxRecord['location'],
                'taxCode': taxRecord['taxCode'],
                'taxItem': taxRecord['taxItem'],
                'locCurrBaseAmount': (baseAmount * exchangeRate),
                'locCurrAmount': round2(amount) * exchangeRate,
                'lineUniqueKey': lineUniqueKey,
                "customSegments": taxRecord["customSegments"],
                "grossAmt": grossAmt,
                "discAmt": discAmt,
                "locCurrGrossAmt": grossAmt * exchangeRate,
                "locCurrDiscAmt": discAmt * exchangeRate
              };

              //taxResults.push(taxResult);

              var appliesto = 'total';
              if (Number(taxRecord['appliesto']) == 2) {
                appliesto = String(position)
              }

              var group = taxRecord['taxgroup'];
              if (!totalTaxResults[group]) {
                totalTaxResults[group] = {};
              }

              if (!totalTaxResults[group][appliesto]) {
                totalTaxResults[group][appliesto] = [];
              }

              totalTaxResults[group][appliesto].push(taxResult);
            }

          }
        }
      }
    }


    function getExchangeRate(recordObj, currencySetup) {
      var exchangerate = 1;
      var featureMB = runtime.isFeatureInEffect({
        feature: "MULTIBOOK"
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

    function getSetupTaxSubsidiary(subsidiary) {
      var filters = [
        ['isinactive', 'is', 'F'], 'AND'
      ];
      if (featureSubs == true || featureSubs == 'T') {
        filters.push(['custrecord_lmry_setuptax_subsidiary', 'anyof', subsidiary]);
      }

      var search_setupSub = search.create({
        type: 'customrecord_lmry_setup_tax_subsidiary',
        filters: filters,
        columns: ['custrecord_lmry_setuptax_subsidiary', 'custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_depclassloc',
          'custrecord_lmry_setuptax_type_rounding', 'custrecord_lmry_setuptax_department', 'custrecord_lmry_setuptax_class',
          'custrecord_lmry_setuptax_location', 'custrecord_lmry_setuptax_br_minim_tax', 'custrecord_lmry_setuptax_form_invoice', 'custrecord_lmry_setuptax_form_creditmemo'
        ]
      });


      var results = search_setupSub.run().getRange(0, 1);

      var setupSubsidiary = {};

      if (results && results.length > 0) {
        setupSubsidiary['isDefaultClassification'] = results[0].getValue('custrecord_lmry_setuptax_depclassloc');
        setupSubsidiary['rounding'] = results[0].getValue('custrecord_lmry_setuptax_type_rounding');
        setupSubsidiary['department'] = results[0].getValue('custrecord_lmry_setuptax_department');
        setupSubsidiary['class'] = results[0].getValue('custrecord_lmry_setuptax_class');
        setupSubsidiary['location'] = results[0].getValue('custrecord_lmry_setuptax_location');
        setupSubsidiary['currency'] = results[0].getValue('custrecord_lmry_setuptax_currency');
        setupSubsidiary['minimBRTax'] = results[0].getValue('custrecord_lmry_setuptax_br_minim_tax') || 0.00;
        setupSubsidiary["invoiceform"] = results[0].getValue("custrecord_lmry_setuptax_form_invoice") || "";
        setupSubsidiary["creditmemoform"] = results[0].getValue("custrecord_lmry_setuptax_form_creditmemo") || "";
      }

      return setupSubsidiary;
    }

    function getNationalTaxes(recordObj, subsidiary, taxGroups) {
      var selectedAppliesTo = recordObj.getValue('custbody_lmry_wht_appliesto');
      var taxRecords = {
        'total': [],
        'item': {},
        'catalog': {}
      };
      var subtypes = [];
      for (var group in taxGroups) {
        subtypes = subtypes.concat(taxGroups[group]['subtypes']);
      }

      var trandate = recordObj.getText('trandate');
      var documentType = recordObj.getValue('custbody_lmry_document_type');
      var recordType = recordObj.getValue('baserecordtype');
      var province = recordObj.getValue("custbody_lmry_province");
      var city = recordObj.getValue("custbody_lmry_city");
      var district = recordObj.getValue("custbody_lmry_district");
      var applyWHT = recordObj.getValue("custbody_lmry_apply_wht_code");

      if (TRANSACTIONS[recordType]) {
        var filters = [
          ['isinactive', 'is', 'F'], 'AND',
          ['custrecord_lmry_ntax_datefrom', 'onorbefore', trandate], 'AND',
          ['custrecord_lmry_ntax_dateto', 'onorafter', trandate], 'AND',
          ['custrecord_lmry_ntax_transactiontypes', 'anyof', TRANSACTIONS[recordType]], 'AND',
          ['custrecord_lmry_ntax_taxtype', 'anyof', TAX_TYPE], 'AND',
          ['custrecord_lmry_ntax_appliesto', 'anyof', selectedAppliesTo], 'AND',
          ['custrecord_lmry_ntax_gen_transaction', 'anyof', GEN_TRANSACTION], 'AND',
          ['custrecord_lmry_ntax_sub_type', 'anyof', subtypes]
        ];


        if (Number(selectedAppliesTo) == 2) {
          var items = ['@NONE@'],
            catalogs = ['@NONE@'];
          var dataItem = getDataItem(recordObj);
          if (dataItem['catalogs'].length) {
            catalogs = catalogs.concat(dataItem['catalogs']);
            filters.push('AND', ['custrecord_lmry_ntax_catalog', 'anyof', catalogs]);
          } else if (dataItem['items'].length) {
            items = items.concat(dataItem['items']);
            filters.push('AND', ['custrecord_lmry_ntax_applies_to_item', 'anyof', items]);
          }
        }

        var filterDoc = ['@NONE@'];
        if (documentType) {
          filterDoc.push(documentType);
        }
        filters.push('AND', ['custrecord_lmry_ntax_fiscal_doctype', 'anyof', filterDoc]);

        if (featureSubs == true || featureSubs == 'T') {
          filters.push('AND', ['custrecord_lmry_ntax_subsidiary', 'anyof', subsidiary]);
        }

        var provinces = ['@NONE@'];
        if (province) {
          provinces.push(province);
        }

        var cities = ['@NONE@'];
        if (city) {
          cities.push(city)
        }

        var districts = ['@NONE@'];
        if (district) {
          districts.push(district);
        }

        filters.push('AND', [
          [
            ["custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "is", "F"]
          ], "OR", [
            ["custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "is", "T"],
            "AND", ["custrecord_lmry_ntax_province", "anyof", provinces],
            "AND", ["custrecord_lmry_ntax_city", "anyof", cities],
            "AND", ["custrecord_lmry_ntax_district", "anyof", districts]
          ]
        ]);


        var search_natTax = search.create({
          type: 'customrecord_lmry_national_taxes',
          columns: [{
              name: "custrecord_lmry_ntax_appliesto",
              sort: search.Sort.ASC
            },
            {
              name: "custrecord_lmry_ntax_applies_to_item",
              sort: search.Sort.ASC
            },
            {
              name: "custrecord_lmry_ntax_catalog",
              sort: search.Sort.ASC
            },
            {
              name: "internalid",
              sort: search.Sort.ASC
            },
            'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_ntax_amount', 'custrecord_lmry_ntax_subtype',
            'custrecord_lmry_ntax_sub_type', 'custrecord_lmry_ntax_minamount', 'custrecord_lmry_ntax_maxamount',
            'custrecord_lmry_ntax_debit_account', 'custrecord_lmry_ntax_credit_account',
            'custrecord_lmry_ntax_department', 'custrecord_lmry_ntax_class', 'custrecord_lmry_ntax_location',
            'custrecord_lmry_ntax_base_amount', 'custrecord_lmry_ntax_addratio', 'custrecord_lmry_ntax_not_taxable_minimum', 'custrecord_lmry_ntax_set_baseretention',
            'custrecord_lmry_ntax_taxitem', 'custrecord_lmry_ntax_taxcode',
            'custrecord_lmry_ntax_br_wht_receita', "custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "custrecord_lmry_ntax_config_segment"
          ],
          filters: filters
        });

        var results = search_natTax.run().getRange(0, 1000);

        if (results && results.length) {
          for (var i = 0; i < results.length; i++) {
            var internalid = results[i].getValue('internalid');
            var subtype = results[i].getText('custrecord_lmry_ntax_sub_type');
            var subtypeid = results[i].getValue('custrecord_lmry_ntax_sub_type');
            var rate = results[i].getValue('custrecord_lmry_ntax_taxrate');
            var amount_to = results[i].getValue('custrecord_lmry_ntax_amount') || 1;
            var minim = results[i].getValue('custrecord_lmry_ntax_minamount') || 0.00;
            var maxim = results[i].getValue('custrecord_lmry_ntax_maxamount') || 0.00;
            var debitAccount = results[i].getValue('custrecord_lmry_ntax_debit_account');
            var creditAccount = results[i].getValue('custrecord_lmry_ntax_credit_account');
            var department = results[i].getValue('custrecord_lmry_ntax_department');
            var classNT = results[i].getValue('custrecord_lmry_ntax_class');
            var location = results[i].getValue('custrecord_lmry_ntax_location');
            var baseAmount = results[i].getValue('custrecord_lmry_ntax_base_amount');
            var ratio = results[i].getValue('custrecord_lmry_ntax_addratio') || 1.0;
            var notTaxableMin = results[i].getValue('custrecord_lmry_ntax_not_taxable_minimum') || 0.00;
            var baseRetention = results[i].getValue('custrecord_lmry_ntax_set_baseretention') || 0.00;
            var taxItem = results[i].getValue('custrecord_lmry_ntax_taxitem');
            var taxCode = results[i].getValue('custrecord_lmry_ntax_taxcode');
            var receita = results[i].getValue('custrecord_lmry_ntax_br_wht_receita');
            var catalog = results[i].getValue('custrecord_lmry_ntax_catalog');
            var idItem = results[i].getValue('custrecord_lmry_ntax_applies_to_item');
            var isTaxByLocation = results[i].getValue({
              name: "custrecord_lmry_tax_by_location",
              join: "custrecord_lmry_ntax_sub_type"
            });
            var segmentsNT = results[i].getValue("custrecord_lmry_ntax_config_segment") || "";
            if (segmentsNT) {
              segmentsNT = JSON.parse(segmentsNT);
            }

            if (((isTaxByLocation || isTaxByLocation == 'T') && (applyWHT || applyWHT == 'T')) || (!isTaxByLocation || isTaxByLocation == 'F')) {
              var taxgroup = '';
              for (var idgroup in taxGroups) {
                if (taxGroups[idgroup]['subtypes'].indexOf(String(subtypeid)) != -1) {
                  taxgroup = String(idgroup);
                  break;
                }
              }

              var ntaxObj = {
                'typeRecord': 'ntax',
                'appliesto': selectedAppliesTo,
                'idItem': idItem,
                'internalid': internalid,
                'subtype': subtype,
                'subtypeid': subtypeid,
                'rate': parseFloat(rate),
                'amountTo': amount_to,
                'minim': minim,
                'maxim': maxim,
                'debitAccount': debitAccount,
                'creditAccount': creditAccount,
                'department': department,
                'class': classNT,
                'location': location,
                'baseAmount': baseAmount,
                'ratio': ratio,
                'notTaxableMin': notTaxableMin,
                'baseRetention': baseRetention,
                'taxItem': taxItem,
                'taxCode': taxCode,
                'receita': receita,
                'taxgroup': taxgroup,
                'catalog': catalog,
                "customSegments": segmentsNT
              };

              if (Number(selectedAppliesTo) == 1) {
                taxRecords['total'].push(ntaxObj);
              } else if (Number(selectedAppliesTo) == 2) {
                if (idItem) {
                  if (!taxRecords['item'][idItem]) {
                    taxRecords['item'][idItem] = [];
                  }

                  taxRecords['item'][idItem].push(ntaxObj);
                }

                if (catalog) {
                  if (!taxRecords['catalog'][catalog]) {
                    taxRecords['catalog'][catalog] = [];
                  }

                  taxRecords['catalog'][catalog].push(ntaxObj);
                }

              }
            }
          }
        }
      }
      return taxRecords;
    }

    function getContributoryClasses(recordObj, subsidiary, taxGroups) {
      var selectedAppliesTo = recordObj.getValue('custbody_lmry_wht_appliesto');
      var taxRecords = {
        'total': [],
        'item': {},
        'catalog': {}
      };
      var subtypes = [];
      for (var group in taxGroups) {
        subtypes = subtypes.concat(taxGroups[group]['subtypes']);
      }

      var trandate = recordObj.getText('trandate');
      var documentType = recordObj.getValue('custbody_lmry_document_type');
      var entity = recordObj.getValue('entity');
      var recordType = recordObj.getValue('baserecordtype');
      var province = recordObj.getValue("custbody_lmry_province");
      var city = recordObj.getValue("custbody_lmry_city");
      var district = recordObj.getValue("custbody_lmry_district");
      var applyWHT = recordObj.getValue("custbody_lmry_apply_wht_code");

      if (TRANSACTIONS[recordType]) { //Invoice

        var filters = [
          ['isinactive', 'is', 'F'], 'AND',
          ['custrecord_lmry_ar_ccl_fechdesd', 'onorbefore', trandate], 'AND',
          ['custrecord_lmry_ar_ccl_fechhast', 'onorafter', trandate], 'AND',
          ['custrecord_lmry_ccl_transactiontypes', 'anyof', TRANSACTIONS[recordType]], 'AND',
          ['custrecord_lmry_ccl_taxtype', 'anyof', TAX_TYPE], 'AND',
          ['custrecord_lmry_ar_ccl_entity', 'anyof', entity], 'AND',
          ['custrecord_lmry_ccl_appliesto', 'anyof', selectedAppliesTo], 'AND',
          ['custrecord_lmry_ccl_gen_transaction', 'anyof', GEN_TRANSACTION], 'AND',
          ['custrecord_lmry_sub_type', 'anyof', subtypes]
        ];


        if (Number(selectedAppliesTo) == 2) {
          var items = ['@NONE@'],
            catalogs = ['@NONE@'];
          var dataItem = getDataItem(recordObj);
          if (dataItem['catalogs'].length) {
            catalogs = catalogs.concat(dataItem['catalogs']);
            filters.push('AND', ['custrecord_lmry_br_ccl_catalog', 'anyof', catalogs]);
          } else if (dataItem['items'].length) {
            items = items.concat(dataItem['items']);
            filters.push('AND', ['custrecord_lmry_ccl_applies_to_item', 'anyof', items]);
          }
        }

        var filterDoc = ['@NONE@'];
        if (documentType) {
          filterDoc.push(documentType);
        }
        filters.push("AND", ['custrecord_lmry_ccl_fiscal_doctype', 'anyof', filterDoc]);

        if (featureSubs == true || featureSubs == 'T') {
          filters.push("AND", ['custrecord_lmry_ar_ccl_subsidiary', 'anyof', subsidiary]);
        }

        var provinces = ['@NONE@'];
        if (province) {
          provinces.push(province);
        }

        var cities = ['@NONE@'];
        if (city) {
          cities.push(city)
        }

        var districts = ['@NONE@'];
        if (district) {
          districts.push(district);
        }

        filters.push('AND', [
          [
            ["custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "is", "F"]
          ], "OR", [
            ["custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "is", "T"],
            'AND', ["custrecord_lmry_ccl_province", "anyof", provinces],
            'AND', ["custrecord_lmry_ccl_city", "anyof", cities],
            'AND', ["custrecord_lmry_ccl_district", "anyof", districts]
          ]
        ]);

        var search_ccls = search.create({
          type: 'customrecord_lmry_ar_contrib_class',
          columns: [{
              name: "custrecord_lmry_ccl_appliesto",
              sort: search.Sort.ASC
            },
            {
              name: "custrecord_lmry_ccl_applies_to_item",
              sort: search.Sort.ASC
            },
            {
              name: "custrecord_lmry_br_ccl_catalog",
              sort: search.Sort.ASC
            },
            {
              name: "internalid",
              sort: search.Sort.ASC
            },
            'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_amount', 'custrecord_lmry_ar_ccl_subtype',
            'custrecord_lmry_sub_type', 'custrecord_lmry_ccl_minamount', 'custrecord_lmry_ccl_maxamount',
            'custrecord_lmry_br_ccl_account1', 'custrecord_lmry_br_ccl_account2',
            'custrecord_lmry_ar_ccl_department', 'custrecord_lmry_ar_ccl_class', 'custrecord_lmry_ar_ccl_location',
            'custrecord_lmry_ccl_base_amount', 'custrecord_lmry_ccl_addratio', 'custrecord_lmry_ccl_not_taxable_minimum', 'custrecord_lmry_ccl_set_baseretention',
            'custrecord_lmry_ar_ccl_taxitem', 'custrecord_lmry_ar_ccl_taxcode',
            'custrecord_lmry_br_cc_wht_receta', "custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "custrecord_lmry_ccl_config_segment"
          ],
          filters: filters
        });

        var results = search_ccls.run().getRange(0, 1000);

        if (results && results.length) {
          for (var i = 0; i < results.length; i++) {
            var internalid = results[i].getValue('internalid');
            var subtype = results[i].getText('custrecord_lmry_sub_type');
            var subtypeid = results[i].getValue('custrecord_lmry_sub_type');
            var rate = results[i].getValue('custrecord_lmry_ar_ccl_taxrate');
            var amount_to = results[i].getValue('custrecord_lmry_amount') || 1;
            var minim = results[i].getValue('custrecord_lmry_ccl_minamount') || 0.00;
            var maxim = results[i].getValue('custrecord_lmry_ccl_maxamount') || 0.00;
            var debitAccount = results[i].getValue('custrecord_lmry_br_ccl_account1');
            var creditAccount = results[i].getValue('custrecord_lmry_br_ccl_account2');
            var department = results[i].getValue('custrecord_lmry_ar_ccl_department');
            var classCC = results[i].getValue('custrecord_lmry_ar_ccl_class');
            var location = results[i].getValue('custrecord_lmry_ar_ccl_location');
            var baseAmount = results[i].getValue('custrecord_lmry_ccl_base_amount');
            var ratio = results[i].getValue('custrecord_lmry_ccl_addratio') || 1.0;
            var notTaxableMin = results[i].getValue('custrecord_lmry_ccl_not_taxable_minimum') || 0.00;
            var baseRetention = results[i].getValue('custrecord_lmry_ccl_set_baseretention') || 0.00;
            var taxItem = results[i].getValue('custrecord_lmry_ar_ccl_taxitem');
            var taxCode = results[i].getValue('custrecord_lmry_ar_ccl_taxcode');
            var receita = results[i].getValue('custrecord_lmry_br_cc_wht_receta');
            var catalog = results[i].getValue('custrecord_lmry_br_ccl_catalog');
            var idItem = results[i].getValue('custrecord_lmry_ccl_applies_to_item');
            var isTaxByLocation = results[i].getValue({
              name: "custrecord_lmry_tax_by_location",
              join: "custrecord_lmry_sub_type"
            });
            var segmentsCC = results[i].getValue("custrecord_lmry_ccl_config_segment") || "";
            if (segmentsCC) {
              segmentsCC = JSON.parse(segmentsCC);
            }

            if (((isTaxByLocation || isTaxByLocation == 'T') && (applyWHT || applyWHT == 'T')) || (!isTaxByLocation || isTaxByLocation == 'F')) {

              var taxgroup = '';
              for (var idgroup in taxGroups) {
                if (taxGroups[idgroup]['subtypes'].indexOf(String(subtypeid)) != -1) {
                  taxgroup = String(idgroup);
                  break;
                }
              }

              var cclassObj = {
                'typeRecord': 'ccl',
                'appliesto': selectedAppliesTo,
                'idItem': idItem,
                'internalid': internalid,
                'subtype': subtype,
                'subtypeid': subtypeid,
                'rate': parseFloat(rate),
                'amountTo': amount_to,
                'minim': minim,
                'maxim': maxim,
                'debitAccount': debitAccount,
                'creditAccount': creditAccount,
                'department': department,
                'class': classCC,
                'location': location,
                'baseAmount': baseAmount,
                'ratio': ratio,
                'notTaxableMin': notTaxableMin,
                'baseRetention': baseRetention,
                'taxItem': taxItem,
                'taxCode': taxCode,
                'receita': receita,
                'taxgroup': taxgroup,
                'catalog': catalog,
                "customSegments": segmentsCC
              };

              if (Number(selectedAppliesTo) == 1) {
                taxRecords['total'].push(cclassObj);
              } else if (Number(selectedAppliesTo) == 2) {
                if (idItem) {
                  if (!taxRecords['item'][idItem]) {
                    taxRecords['item'][idItem] = [];
                  }

                  taxRecords['item'][idItem].push(cclassObj);
                }


                if (catalog) {
                  if (!taxRecords['catalog'][catalog]) {
                    taxRecords['catalog'][catalog] = [];
                  }

                  taxRecords['catalog'][catalog].push(cclassObj);
                }
              }
            }
          }
        }
      }
      return taxRecords;
    }



    function getTaxGroups(subsidiary) {
      var taxGroups = {};
      var search_groups = search.create({
        type: 'customrecord_lmry_tax_wht_group',
        filters: [
          ['isinactive', 'is', 'F'], 'AND',
          ['custrecord_lmry_taxwhtgroup_subsidiary', 'is', subsidiary], 'AND',
          ['custrecord_lmry_taxwhtgroup_taxtype', 'is', TAX_TYPE]
        ],
        columns: [{
            name: 'internalid',
            sort: search.Sort.ASC
          },
          'custrecord_lmry_taxwhtgroup_subtypes',
          'custrecord_lmry_taxwhtgroup_br_minim_wht'
        ]
      });

      var results = search_groups.run().getRange(0, 1000);

      if (results && results.length) {
        for (var i = 0; i < results.length; i++) {
          var internalid = results[i].getValue('internalid');
          internalid = String(internalid);
          var subtypes = results[i].getValue('custrecord_lmry_taxwhtgroup_subtypes');
          var minim = results[i].getValue('custrecord_lmry_taxwhtgroup_br_minim_wht') || 0.00;
          if (subtypes) {
            subtypes = subtypes.split(',');
            taxGroups[internalid] = {
              'minim': minim,
              'subtypes': subtypes
            };
          }
        }
      }

      return taxGroups;
    }

    function deleteTaxResults(recordId) {
      if (recordId) {

        var searchTaxResults = search.create({
          type: 'customrecord_lmry_br_transaction',
          filters: [
            ['custrecord_lmry_br_transaction', 'anyof', recordId], 'AND',
            ['custrecord_lmry_tax_type', 'anyof', TAX_TYPE]
          ],
          columns: ['internalid']
        });

        var results = searchTaxResults.run().getRange(0, 1000);
        log.error("results", JSON.stringify(results));
        if (results && results.length) {
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

    function round4(amount) {
      return parseFloat(Math.round(parseFloat(amount) * 1e4 + 1e-14) / 1e4);
    }

    function round2(amount) {
      return parseFloat(Math.round(parseFloat(amount) * 1e2 + 1e-14) / 1e2);
    }

    function concatAccountingBooks(recordObj) {
      var auxBookMB = 0;
      var auxExchangeMB = recordObj.getValue({
        fieldId: 'exchangerate'
      });

      var featureMB = runtime.isFeatureInEffect({
        feature: "MULTIBOOK"
      });

      if (featureMB) {
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
      }
      return auxBookMB + '&' + auxExchangeMB;
    }

    function saveTaxResult(idTransaction, taxResultObj, strAccountingBooks) {
      var recordTaxResult = record.create({
        type: 'customrecord_lmry_br_transaction'
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_related_id',
        value: String(idTransaction)
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_transaction',
        value: String(idTransaction)
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_type',
        value: taxResultObj['subtype']
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_type_id',
        value: taxResultObj['subtypeid']
      });


      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_base_amount',
        value: round4(taxResultObj['baseAmount'])
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_total',
        value: round4(taxResultObj['fxamount'])
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_total_base_currency',
        value: round4(taxResultObj['amount'])
      });


      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_percent',
        value: taxResultObj['taxRate']
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_total_item',
        value: taxResultObj['type']
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_item',
        value: taxResultObj['idItem']
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_positem',
        value: taxResultObj['position']
      });

      var fieldIdRecord = 'custrecord_lmry_' + taxResultObj['typeRecord'];

      recordTaxResult.setValue({
        fieldId: fieldIdRecord,
        value: taxResultObj['idRecord']
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_ccl',
        value: String(taxResultObj['idRecord'])
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_accounting_books',
        value: strAccountingBooks
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_tax_type',
        value: TAX_TYPE
      });

      recordTaxResult.setValue({
        fieldId: 'custrecord_lmry_br_receta',
        value: taxResultObj['receita']
      });

      if (recordTaxResult.getField({
          fieldId: 'custrecord_lmry_base_amount_local_currc'
        })) {
        recordTaxResult.setValue({
          fieldId: 'custrecord_lmry_base_amount_local_currc',
          value: taxResultObj['locCurrBaseAmount']
        });
      }

      if (recordTaxResult.getField({
          fieldId: 'custrecord_lmry_amount_local_currency'
        })) {
        recordTaxResult.setValue({
          fieldId: 'custrecord_lmry_amount_local_currency',
          value: taxResultObj['locCurrAmount']
        });
      }


      if (recordTaxResult.getField({
          fieldId: 'custrecord_lmry_lineuniquekey'
        })) {
        recordTaxResult.setValue({
          fieldId: 'custrecord_lmry_lineuniquekey',
          value: taxResultObj['lineUniqueKey']
        });
      }

      if (taxResultObj["grossAmt"]) {
        recordTaxResult.setValue({
          fieldId: "custrecord_lmry_gross_amt",
          value: taxResultObj["grossAmt"]
        });
      }

      if (taxResultObj["discAmt"]) {
        recordTaxResult.setValue({
          fieldId: "custrecord_lmry_discount_amt",
          value: taxResultObj["discAmt"]
        });
      }

      if (taxResultObj["locCurrGrossAmt"]) {
        recordTaxResult.setValue({
          fieldId: "custrecord_lmry_gross_amt_local_curr",
          value: taxResultObj["locCurrGrossAmt"]
        });
      }

      if (taxResultObj["locCurrDiscAmt"]) {
        recordTaxResult.setValue({
          fieldId: "custrecord_lmry_discount_amt_local_curr",
          value: taxResultObj["locCurrDiscAmt"]
        });
      }

      recordTaxResult.save({
        ignoreMandatoryFields: true,
        disableTriggers: true,
        enableSourcing: true
      });
    }

    function createWHTTransaction(recordObj, taxResults, setupSubsidiary, customSegments, installments) {
      var recordType = recordObj.getValue('baserecordtype');

      var idTransaction = recordObj.id;
      var idNewRecord = null;

      if (CONFIG_TRANSACTION[recordType]) {
        if (taxResults && taxResults.length) {
          var form = setupSubsidiary[CONFIG_TRANSACTION[recordType]['form']];

          if (form) {
            var entity = recordObj.getValue('entity');
            var subsidiary = recordObj.getValue("subsidiary");
            var date = recordObj.getValue('trandate');
            date = format.parse({
              value: date,
              type: format.Type.DATE
            });
            var postingperiod = recordObj.getValue('postingperiod');

            var departmentTr = recordObj.getValue('department');
            var classTr = recordObj.getValue('class');
            var locationTr = recordObj.getValue('location');

            var featureMultiPrice = runtime.isFeatureInEffect({
              feature: 'MULTPRICE'
            });

            var departmentFeat = runtime.isFeatureInEffect({
              feature: "DEPARTMENTS"
            });
            var locationFeat = runtime.isFeatureInEffect({
              feature: "LOCATIONS"
            });
            var classFeat = runtime.isFeatureInEffect({
              feature: "CLASSES"
            });

            var account = recordObj.getValue('account');

            var exchangeRate = recordObj.getValue('exchangerate');

            var currency = recordObj.getValue('currency');

            var transactionCustSegments = {};
            for (var i = 0; i < customSegments.length; i++) {
              var customSegmentId = customSegments[i];
              if (customSegmentId) {
                var customSegmentValue = recordObj.getValue(customSegmentId);
                if (customSegmentValue) {
                  transactionCustSegments[customSegmentId] = customSegmentValue;
                }
              }
            }

            var segmentationLines = {};

            var numItems = recordObj.getLineCount({
              sublistId: "items"
            });
            for (var i = 0; i < numItems; i++) {
              segmentationLines[String(i)] = {
                "department": recordObj.getSublistValue({
                  sublistId: "item",
                  fieldId: "department",
                  line: i
                }) || "",
                "class": recordObj.getSublistValue({
                  sublistId: "item",
                  fieldId: "class",
                  line: i
                }) || "",
                "location": recordObj.getSublistValue({
                  sublistId: "item",
                  fieldId: "location",
                  line: i
                }) || ""
              };

              for (var s = 0; s < customSegments.length; s++) {
                var customSegmentId = customSegments[s];
                segmentationLines[String(i)][customSegmentId] = recordObj.getSublistValue({
                  sublistId: "item",
                  fieldId: customSegmentId,
                  line: i
                }) || "";
              }
            }

            var numberInstallments = 0;
            if (FEAT_INSTALLMENTS == true || FEAT_INSTALLMENTS == "T") {
              numberInstallments = recordObj.getLineCount({
                sublistId: "installlment"
              });
            }

            var fromType = "invoice";
            var fromId = idTransaction;
            if (recordType == "creditmemo") {
              fromType = "customer";
              fromId = entity;
            }


            var toType = CONFIG_TRANSACTION[recordType]['recordtype'];
            var recordTransaction = record.transform({
              fromType: fromType,
              fromId: fromId,
              toType: toType,
              isDynamic: false,
              defaultValues: {
                'customform': form
              }
            });

            //recordTransaction.setValue('customform', form);
            if (toType == "invoice") {
              recordTransaction.setValue("subsidiary", subsidiary);
              recordTransaction.setValue("entity", entity);
            }
            recordTransaction.setValue('trandate', date);
            recordTransaction.setValue('postingperiod', postingperiod);
            recordTransaction.setValue('memo', MEMO_TRANSACTION);
            recordTransaction.setValue('account', account);
            recordTransaction.setValue('exchangerate', exchangeRate);
            recordTransaction.setValue('currency', currency);
            recordTransaction.setValue('custbody_lmry_reference_transaction', idTransaction);
            recordTransaction.setValue('custbody_lmry_reference_transaction_id', idTransaction);
            recordTransaction.setValue('custbody_lmry_reference_entity', entity);
            recordTransaction.setValue("terms", "");

            if (FEATURE_TRANSACTION[toType]) {
              var approvalFeature = runtime.getCurrentScript().getParameter({
                name: FEATURE_TRANSACTION[toType]
              });
              if (approvalFeature == true || approvalFeature == 'T') {
                recordTransaction.setValue('approvalstatus', 2);
              }
            }

            if (departmentFeat == true || departmentFeat == 'T') {
              recordTransaction.setValue('department', departmentTr);
            }

            if (classFeat == true || classFeat == 'T') {
              recordTransaction.setValue('class', classTr);
            }

            if (locationFeat == true || locationFeat == 'T') {
              recordTransaction.setValue('location', locationTr);
            }

            for (var s = 0; s < customSegments.length; s++) {
              var customSegmentId = customSegments[s];
              if (recordTransaction.getField(customSegmentId)) {
                var customSegmentValue = transactionCustSegments[customSegmentId] || "";
                recordTransaction.setValue(customSegmentId, customSegmentValue);
              }
            }

            //Limpiar campos copiados del invoice
            recordTransaction.setValue('custbody_lmry_document_type', '');
            recordTransaction.setValue('custbody_lmry_serie_doc_cxc', '');
            recordTransaction.setValue('custbody_lmry_num_preimpreso', '');
            recordTransaction.setValue('custbody_lmry_informacion_adicional', '');
            recordTransaction.setValue('custbody_lmry_apply_wht_code', false);

            //Tax Detail feature
            recordTransaction.setValue('taxdetailsoverride', true);

            //Campos de facturacion
            if (recordTransaction.getField({
                fieldId: 'custbody_psg_ei_template'
              })) {
              recordTransaction.setValue('custbody_psg_ei_template', '');
            }

            if (recordTransaction.getField({
                fieldId: 'custbody_psg_ei_status'
              })) {
              recordTransaction.setValue('custbody_psg_ei_status', '');
            }

            if (recordTransaction.getField({
                fieldId: 'custbody_psg_ei_sending_method'
              })) {
              recordTransaction.setValue('custbody_psg_ei_sending_method', '');
            }

            if (recordTransaction.getField({
                fieldId: 'custbody_psg_ei_generated_edoc'
              })) {
              recordTransaction.setValue('custbody_psg_ei_generated_edoc', '');
            }

            var amountWHT = 0.00;

            if (toType == "creditmemo") {
              //si se genera un creditmemo se elimina los items que viene del invoice
              removeAllItems(recordTransaction);
            }

            for (var i = 0; i < taxResults.length; i++) {
              var taxResult = taxResults[i];
              var itemIdx = taxResult["position"];

              var amount = round2(taxResult['fxamount']);
              amountWHT += amount;

              recordTransaction.insertLine({
                sublistId: 'item',
                line: i
              });
              recordTransaction.setSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: taxResult['taxItem'],
                line: i
              });


              if (featureMultiPrice == true || featureMultiPrice == 'T') {
                recordTransaction.setSublistValue({
                  sublistId: 'item',
                  fieldId: 'price',
                  value: -1,
                  line: i
                });
              }
              recordTransaction.setSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: amount,
                line: i
              });
              recordTransaction.setSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                value: amount,
                line: i
              });

              var description = taxResult['subtype'] + MEMO_LINE;
              if (Number(taxResult['appliesto']) == 2) {
                description += ' - (ID Item: ' + taxResult['idItem'] + ')';
              }
              recordTransaction.setSublistValue({
                sublistId: 'item',
                fieldId: 'description',
                value: description,
                line: i
              });

              if (departmentFeat == true || departmentFeat == 'T') {
                var depField = recordTransaction.getSublistField({
                  sublistId: 'item',
                  fieldId: 'department',
                  line: i
                });
                var departmentLine = taxResult["department"];
                if (!departmentLine && segmentationLines[itemIdx] && segmentationLines[itemIdx]["department"]) {
                  departmentLine = segmentationLines[itemIdx]["department"];
                }

                departmentLine = departmentLine || departmentTr || "";
                if (depField && departmentLine) {
                  recordTransaction.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'department',
                    value: departmentLine,
                    line: i
                  });
                }
              }

              if (classFeat == true || classFeat == 'T') {
                var classField = recordTransaction.getSublistField({
                  sublistId: 'item',
                  fieldId: 'class',
                  line: i
                });
                var classLine = taxResult["class"];
                if (!classLine && segmentationLines[itemIdx] && segmentationLines[itemIdx]["class"]) {
                  classLine = segmentationLines[itemIdx]["class"];
                }
                classLine = classLine || classTr || "";
                if (classField && classLine) {
                  recordTransaction.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'class',
                    value: classLine,
                    line: i
                  });
                }
              }

              if (locationFeat == true || locationFeat == 'T') {
                var locField = recordTransaction.getSublistField({
                  sublistId: 'item',
                  fieldId: 'location',
                  line: i
                });
                var locationLine = taxResult["class"];
                if (!locationLine && segmentationLines[itemIdx] && segmentationLines[itemIdx]["location"]) {
                  locationLine = segmentationLines[itemIdx]["location"];
                }
                locationLine = locationLine || locationTr || "";
                if (locField && locationLine) {
                  recordTransaction.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    value: locationLine,
                    line: i
                  });
                }
              }

              for (var s = 0; s < customSegments.length; s++) {
                var customSegmentId = customSegments[s];
                var customSegmentValue = "";
                if (taxResult["customSegments"] && taxResult["customSegments"][customSegmentId]) {
                  customSegmentValue = taxResult["customSegments"][customSegmentId];
                }

                if (!customSegmentValue && segmentationLines[itemIdx] && segmentationLines[itemIdx][customSegmentId]) {
                  customSegmentValue = segmentationLines[itemIdx][customSegmentId];
                }

                customSegmentValue = customSegmentValue || transactionCustSegments[customSegmentId] || "";
                var customSegmentField = recordTransaction.getSublistField({
                  sublistId: 'item',
                  fieldId: customSegmentId,
                  line: i
                });
                if (customSegmentField && customSegmentValue) {
                  recordTransaction.setSublistValue({
                    sublistId: 'item',
                    fieldId: customSegmentId,
                    value: customSegmentValue,
                    line: i
                  });
                }
              }


              recordTransaction.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_lmry_ar_perception_amount',
                value: taxResult['baseAmount'],
                line: i
              });
              recordTransaction.setSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_lmry_ar_perception_percentage',
                value: taxResult['taxRate'],
                line: i
              });

            }


            if (toType == "creditmemo") {
              //si se genero un creditmemo se aplica el invoice de donde se creo.
              var numApply = recordTransaction.getLineCount({
                sublistId: 'apply'
              });

              for (var i = 0; i < numApply; i++) {
                var lineTransaction = recordTransaction.getSublistValue({
                  sublistId: 'apply',
                  fieldId: 'internalid',
                  line: i
                });

                var instNumber = recordTransaction.getSublistValue({
                  sublistId: "apply",
                  fieldId: "installmentnumber",
                  line: i
                });

                if (Number(lineTransaction) == Number(idTransaction)) {

                  recordTransaction.setSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    value: true,
                    line: i
                  });

                  if (numberInstallments) {
                    if (installments[String(instNumber)] && installments[String(instNumber)]["wht"]) {
                      var partialWht = installments[String(instNumber)]["wht"]
                      recordTransaction.setSublistValue({
                        sublistId: "apply",
                        fieldId: "amount",
                        value: partialWht,
                        line: i
                      });
                    }
                  } else {
                    recordTransaction.setSublistValue({
                      sublistId: 'apply',
                      fieldId: 'amount',
                      value: parseFloat(amountWHT),
                      line: i
                    });
                    break;
                  }
                }
              }
            }

            idNewRecord = recordTransaction.save({
              ignoreMandatoryFields: true,
              disableTriggers: true,
              enableSourcing: true
            });
          }
        }
      }
      idNewRecord = setTaxDetailLines(idNewRecord, taxResults, recordObj);
      log.error('idNewRecord', idNewRecord);
      return idNewRecord;
    }

    function setTaxDetailLines(creditMemoId, taxResults, invoiceObj) {

      try {
        var recordObj = record.load({
          type: 'creditmemo',
          id: creditMemoId,
          isDynamic: false
        });

        // Tax Details fields del Invoice
        var nexus = invoiceObj.getValue({ fieldId: 'nexus' });
        var nexusOverRide = invoiceObj.getValue({ fieldId: 'taxregoverride' });
        var transactionType = invoiceObj.getValue({ fieldId: 'custbody_ste_transaction_type' });
        var subTaxRegNumber = invoiceObj.getValue({ fieldId: 'subsidiarytaxregnum' });
        var entityTaxRegNumber = invoiceObj.getValue({ fieldId: 'entitytaxregnum' });

        // Tax Details fields del Credit MEMO_LINE
        recordObj.setValue({ fieldId: 'nexus', value: nexus });
        recordObj.setValue({ fieldId: 'taxregoverride', value: nexusOverRide });
        recordObj.setValue({ fieldId: 'custbody_ste_transaction_type', value: transactionType });
        recordObj.setValue({ fieldId: 'subsidiarytaxregnum', value: subTaxRegNumber });
        recordObj.setValue({ fieldId: 'entitytaxregnum', value: entityTaxRegNumber });

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
            value: taxResults[i]['baseAmount']
          });
          recordObj.setSublistValue({
            sublistId: 'taxdetails',
            fieldId: 'taxrate',
            line: i,
            value: parseFloat(taxResults[i]['taxRate'] * 100)
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
        log.error('[ ST_WHT - setTaxDetailLines ]', e);
      }

    }


    function applyTransaction(recordObj, idTransaction, amountWHT) {
      var recordType = recordObj.getValue("baserecordtype");

      var oldInvoices = [];

      var searchTransactions = search.create({
        type: "invoice",
        filters: [
          ["mainline", "is", "T"], "AND",
          ["memo", "startswith", MEMO_TRANSACTION], "AND",
          ["custbody_lmry_reference_transaction", "anyof", recordObj.id]
        ],
        columns: [search.createColumn({
          name: "internalid",
          sort: search.Sort.ASC
        })]
      });

      var results = searchTransactions.run().getRange(0, 1000);
      var columns = searchTransactions.columns;

      for (var i = 0; i < results.length; i++) {
        var id = results[i].getValue(columns[0]);
        id = Number(id);
        if (oldInvoices.indexOf(id) == -1 && (Number(id) != Number(idTransaction))) {
          oldInvoices.push(id);
        }
      }

      log.error("oldInvoices", JSON.stringify(oldInvoices));

      var recordTransaction = record.load({
        type: recordType,
        id: recordObj.id,
        isDynamic: true
      });

      var total = recordTransaction.getValue({
        fieldId: "total"
      });
      total = parseFloat(total);

      var numApply = recordTransaction.getLineCount({
        sublistId: 'apply'
      });

      var currentLine = -1

      for (var i = 0; i < numApply; i++) {
        recordTransaction.selectLine({
          sublistId: "apply",
          line: i
        });
        var lineTransaction = recordTransaction.getSublistValue({
          sublistId: 'apply',
          fieldId: 'internalid',
          line: i
        });
        //si existe una transaccion de retencion antigua, se desaplica
        if (oldInvoices.indexOf(Number(lineTransaction)) != -1) {
          recordTransaction.setCurrentSublistValue({
            sublistId: 'apply',
            fieldId: 'apply',
            value: false,
            line: i
          });
        } else if (Number(lineTransaction) == Number(idTransaction)) {
          currentLine = i;
        }
      }

      if (currentLine != -1) {
        recordTransaction.selectLine({
          sublistId: "apply",
          line: currentLine
        });
        recordTransaction.setCurrentSublistValue({
          sublistId: 'apply',
          fieldId: 'apply',
          value: true
        });
        recordTransaction.setCurrentSublistValue({
          sublistId: 'apply',
          fieldId: 'amount',
          value: parseFloat(amountWHT)
        });
      }

      recordTransaction.save({
        ignoreMandatoryFields: true,
        disableTriggers: true,
        enableSourcing: true
      });

      if (oldInvoices.length) {
        for (var i = 0; i < oldInvoices.length; i++) {
          var internalid = oldInvoices[i];
          if (internalid) {
            record.delete({
              type: "invoice",
              id: internalid
            });
          }
        }
      }
    }

    function deleteGeneratedRecords(recordObj) {
      try {
        if (recordObj.id) {
          var transactionType = recordObj.getValue('baserecordtype');
          deleteTaxResults(recordObj.id);

          var whtTransactions = [];
          var search_transactions = search.create({
            type: CONFIG_TRANSACTION[transactionType]["recordtype"],
            filters: [
              ['mainline', 'is', 'T'], 'AND',
              ['custbody_lmry_reference_transaction', 'anyof', recordObj.id], 'AND',
              ['memo', 'startswith', MEMO_TRANSACTION]
            ],
            columns: ['internalid']
          });

          var results = search_transactions.run().getRange(0, 1000);

          for (var i = 0; i < results.length; i++) {
            var internalid = results[i].getValue("internalid");
            whtTransactions.push(Number(internalid));
          }

          if (transactionType == "creditmemo" && whtTransactions.length) {

            var recordTransaction = record.load({
              type: "creditmemo",
              id: recordObj.id,
              isDynamic: true
            });

            var numApply = recordTransaction.getLineCount({
              sublistId: 'apply'
            });

            for (var i = 0; i < numApply; i++) {
              recordTransaction.selectLine({
                sublistId: 'apply',
                line: i
              });

              var lineTransaction = recordTransaction.getSublistValue({
                sublistId: 'apply',
                fieldId: 'internalid',
                line: i
              });

              if (whtTransactions.indexOf(Number(lineTransaction)) != -1) {
                recordTransaction.setCurrentSublistValue({
                  sublistId: 'apply',
                  fieldId: 'apply',
                  value: false
                });
              }
            }

            recordTransaction.save({
              ignoreMandatoryFields: true,
              disableTriggers: true,
              enableSourcing: true
            });
          }


          log.error("whtTransaction", JSON.stringify(whtTransactions));

          for (var i = 0; i < whtTransactions.length; i++) {
            var id = whtTransactions[i];
            record.delete({
              type: CONFIG_TRANSACTION[transactionType]["recordtype"],
              id: id
            });
          }
        }

      } catch (err) {
        library_mail.sendemail('[ LatamTaxWithHoldingBR ] ' + err, LMRY_script);
      }
    }

    function checkWithholdingTax(recordObj) {
      var numLines = recordObj.getLineCount({
        sublistId: 'item'
      });
      var found = false;
      for (var i = 0; i < numLines; i++) {
        var whtApply = recordObj.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_4601_witaxapplies',
          line: i
        });
        if (whtApply == 'T' || whtApply == true) {
          found = true;
          break;
        }
      }
      return found;
    }

    function getValidationsBRTaxes(recordObj, setupSubsidiary) {
      var taxesBR = {};
      var totalTaxes = {};
      var validationsTaxes = {};
      var defaultValue = !setupSubsidiary['minimBRTax'];
      validationsTaxes['total'] = defaultValue;
      var numLines = recordObj.getLineCount({
        sublistId: 'item'
      });
      for (var i = 0; i < numLines; i++) {
        validationsTaxes[String(i)] = defaultValue;
      }

      if (recordObj.id) {
        if (!setupSubsidiary['minimBRTax']) {

          var search_taxResult = search.create({
            type: "customrecord_lmry_br_transaction",
            filters: [
              ["custrecord_lmry_br_transaction", "anyof", recordObj.id], "AND",
              ["custrecord_lmry_tax_type", "anyof", "4"], "AND",
              ["custrecord_lmry_br_transaction.mainline", "is", "T"]
            ],
            columns: [
              search.createColumn({
                name: "custrecord_lmry_br_type",
                summary: "GROUP",
                sort: search.Sort.ASC
              }),
              search.createColumn({
                name: "custrecord_lmry_br_positem",
                summary: "GROUP",
                sort: search.Sort.ASC
              }),
              search.createColumn({
                name: "custrecord_lmry_item",
                summary: "GROUP"
              }),
              search.createColumn({
                name: "custrecord_lmry_total_base_currency",
                summary: "SUM"
              })
            ]
          });


          var results = search_taxResult.run().getRange(0, 1000);
          var columns = search_taxResult.columns;

          if (results && results.length) {
            for (var i = 0; i < results.length; i++) {
              var subtype = results[i].getValue(columns[0]);
              var position = results[i].getValue(columns[1]);
              if (subtype && position) {
                subtype = subtype.trim();
                subtype = String(subtype);

                position = String(position);
                var idItem = results[i].getValue(columns[2]);
                idItem = String(idItem);
                var taxAmount = results[i].getValue(columns[3]);
                taxAmount = round2(taxAmount);
                if (!taxesBR[position]) {
                  taxesBR[position] = {};
                }

                //Se suman los impuestos por item
                taxesBR[position][subtype] = taxesBR[position][subtype] || 0.00;
                taxesBR[position][subtype] += parseFloat(taxAmount);

                //Se suman todos los impuestos de la transaccion
                totalTaxes[subtype] = totalTaxes[subtype] || 0.00;
                totalTaxes[subtype] += parseFloat(taxAmount);

              }
            }

            log.error('taxesBR', JSON.stringify(taxesBR));
            log.error('totalTaxes', JSON.stringify(totalTaxes));

            var minimBRTax = setupSubsidiary['minimBRTax'];
            minimBRTax = parseFloat(minimBRTax);

            //Totales
            var exceedMinim = false;
            for (var subtype in totalTaxes) {
              if (totalTaxes[subtype] < minimBRTax) {
                exceedMinim = true;
                break;
              }
            }
            validationsTaxes['total'] = !exceedMinim;

            //Lines
            for (var position in taxesBR) {
              var exceedMinim = false;
              for (var subtype in taxesBR[position]) {
                if (parseFloat(taxesBR[position][subtype]) < minimBRTax) {
                  exceedMinim = true;
                  break;
                }
              }
              validationsTaxes[position] = !exceedMinim;
            }
          }
        }
      }

      return validationsTaxes;
    }

    function getDataItem(recordObj) {
      var results = {
        'items': [],
        'catalogs': []
      };
      var numLines = recordObj.getLineCount({
        sublistId: 'item'
      });
      for (var i = 0; i < numLines; i++) {
        var idItem = recordObj.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i
        });
        idItem = Number(idItem);

        if (results['items'].indexOf(idItem) == -1) {
          results['items'].push(idItem);
        }

        var catalog = recordObj.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_lmry_br_service_catalog',
          line: i
        });
        catalog = Number(catalog);
        if (catalog && results['catalogs'].indexOf(catalog) == -1) {
          results['catalogs'].push(catalog);
        }
      }
      return results;
    }

    function validateTotalWHT(recordObj, validatedWHTs) {
      var totalAmountWHT = 0.00;
      for (var i = 0; i < validatedWHTs.length; i++) {
        var taxResult = validatedWHTs[i];
        if (taxResult) {
          totalAmountWHT += taxResult['fxamount'];
        }
      }
      var totalAmounts = getTotalAmounts(recordObj);
      log.error("totalAmounts", totalAmounts);
      var totalAmount = totalAmounts["total"];

      return (totalAmountWHT <= parseFloat(totalAmount))
    }


    function removeAllItems(recordObj) {
      while (true) {
        var numberItems = recordObj.getLineCount({
          sublistId: 'item'
        });
        // var numberTaxDetails = recordObj.getLineCount({
        //   sublistId: 'taxdetails'
        // });
        if (numberItems /*&& numberTaxDetails*/) {
          recordObj.removeLine({
            sublistId: 'item',
            line: numberItems - 1
          });
          // recordObj.removeLine({
          //   sublistId: 'taxdetails',
          //   line: numberTaxDetails - 1
          // });
        } else {
          break;
        }
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

    function updateInstallments(recordObj, taxResults, installments) {
      var numberInstallments = recordObj.getLineCount({
        sublistId: "installment"
      });
      if (numberInstallments && taxResults.length) {
        var whtTotal = 0.00;
        for (var i = 0; i < taxResults.length; i++) {
          var amount = taxResults[i]["fxamount"];
          whtTotal = whtTotal + round2(amount);
        }

        var calculatedWhtTotal = 0.00;
        var totalAmounts = getTotalAmounts(recordObj);
        log.error("totalAmounts", JSON.stringify(totalAmounts));
        var total = totalAmounts["total"];

        var lastNumber = "";

        var searchInstallments = search.create({
          type: "invoice",
          filters: [
            ["internalid", "anyof", recordObj.id], "AND",
            ["mainline", "is", "T"]
          ],
          columns: [
            search.createColumn({
              name: "installmentnumber",
              join: "installment",
              sort: search.Sort.ASC
            }),
            "installment.fxamount",
            "internalid"
          ],
          settings: [search.createSetting({
            name: 'consolidationtype',
            value: 'NONE'
          })]
        });

        var columns = searchInstallments.columns;
        var results = searchInstallments.run().getRange(0, 1000);
        for (var i = 0; i < results.length; i++) {
          // var amount = recordObj.getSublistValue({ sublistId: "installment", fieldId: "amount", line: i });
          // amount = parseFloat(amount);
          // var number = recordObj.getSublistValue({ sublistId: "installment", fieldId: "seqnum", line: i });
          var number = results[i].getValue(columns[0]);
          var amount = results[i].getValue(columns[1]);
          amount = parseFloat(amount);

          if (amount && number) {
            lastNumber = number;
            var partialWht = (amount / total) * whtTotal;
            partialWht = round2(partialWht);

            installments[String(number)] = {
              "amount": amount,
              "wht": partialWht
            }
            calculatedWhtTotal += partialWht;
          }
        }

        log.error("installments", JSON.stringify(installments));

        var diff = whtTotal - calculatedWhtTotal;
        log.error("diff", diff);
        if (diff) {
          if (installments[String(lastNumber)]) {
            var partialWht = installments[String(lastNumber)]["wht"];
            partialWht = round2(partialWht + diff);
            installments[String(lastNumber)]["wht"] = partialWht;
          }
        }

        log.error("installments", JSON.stringify(installments));

        var searchBRTransactionFields = search.create({
          type: "customrecord_lmry_br_transaction_fields",
          filters: [
            ["isinactive", "is", "F"], "AND",
            ["custrecord_lmry_br_related_transaction", "anyof", recordObj.id]
          ],
          columns: ["internalid", "custrecord_lmry_br_interes", "custrecord_lmry_br_multa"]
        });

        var results = searchBRTransactionFields.run().getRange(0, 10);
        if (results && results.length) {
          var idBrTransactionField = results[0].getValue("internalid");

          record.submitFields({
            type: "customrecord_lmry_br_transaction_fields",
            id: idBrTransactionField,
            values: {
              "custrecord_lmry_br_installments": JSON.stringify(installments)
            },
            options: {
              disableTriggers: true
            }
          });
        }

        // for (var i = 0; i < numberInstallments; i++) {
        //     var number = recordObj.getSublistValue({ sublistId: "installment", fieldId: "seqnum", line: i });
        //     if (installments[String(number)] && installments[String(number)]["whtamount"]) {
        //         recordObj.setSublistValue({ sublistId: "installment", fieldId: "custrecord_lmry_br_wtax", line: i, value: installments[String(number)]["whtamount"] });
        //     }
        // }
      }
    }

    function getDiscountAmounts(recordObj) {
      var discountAmounts = {};
      var numItems = recordObj.getLineCount({
        sublistId: "item"
      });
      var discountAmount = 0.00,
        currentItemPosition = -1;
      for (var i = 0; i < numItems; i++) {
        var typeDiscount = recordObj.getSublistValue({
          sublistId: "item",
          fieldId: "custcol_lmry_col_sales_type_discount",
          line: i
        });
        if (typeDiscount) {
          if (Number(typeDiscount) == 1) {
            var amount = recordObj.getSublistValue({
              sublistId: "item",
              fieldId: "amount",
              line: i
            }) || 0.00;
            discountAmount += parseFloat(amount);
          }
        } else {

          if (currentItemPosition != -1) {
            discountAmounts[String(currentItemPosition)] = Math.abs(discountAmount);
          }
          currentItemPosition = i;
          discountAmount = 0.00;

        }
      }
      if (currentItemPosition != -1) {
        discountAmounts[String(currentItemPosition)] = Math.abs(discountAmount);
      }

      return discountAmounts;
    }


    function getTotalAmounts(recordObj) {
      var total = 0.00,
        subTotal = 0.00,
        taxTotal = 0.00;
      var numLines = recordObj.getLineCount({
        sublistId: "item"
      });
      for (var i = 0; i < numLines; i++) {
        var netAmt = recordObj.getSublistValue({
          sublistId: 'item',
          fieldId: 'amount',
          line: i
        }) || 0.0;
        netAmt = parseFloat(netAmt);

        var taxAmt = recordObj.getSublistValue({
          sublistId: 'taxdetails',
          fieldId: 'taxamount',
          line: i
        }) || 0.0;
        taxAmt = parseFloat(taxAmt);

        var grossAmt = round2(netAmt + taxAmt);

        taxTotal = round2(taxTotal + taxTotal);
        subTotal = round2(subTotal + netAmt);
        total = round2(total + grossAmt);
      }

      return {
        "total": total,
        "subTotal": subTotal,
        "taxTotal": taxTotal
      };
    }

    return {
      LatamTaxWithHoldingBR: LatamTaxWithHoldingBR,
      deleteGeneratedRecords: deleteGeneratedRecords
    }
  });
