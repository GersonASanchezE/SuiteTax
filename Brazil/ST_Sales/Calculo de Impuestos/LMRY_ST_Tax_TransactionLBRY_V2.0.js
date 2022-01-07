/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ST_TAX_TransactionLBRY_V2.0.js		          ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 05 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/log', 'N/record', 'N/search', 'N/runtime', 'N/format', '../Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', "./LMRY_TAX_Withholding_LBRY_V2.0.js"],
  function (log, record, search, runtime, format, library, libraryWHT) {

    var LMRY_script = 'LatamReady - ST TAX Transaction LBRY V2.0';
    var arreglo_SumaBaseBR = new Array();
    var arreglo_IndiceBaseBR = new Array();
    var blnTaxCalculate = false;
    var totalItemTaxes = {};
    var applyWHT = false;

    /**************************************************************************
     * Funcion que elimina los Journal y Registros del récord "LatamReady - Tax
     * Results" en caso se elimine la transacción
     * Llamada desde el User Event del Invoice, Credit Memo, Bill y Bill Credit
     *************************************************************************/
    function beforeSubmitTransaction(scriptContext) {
      try {
        if (scriptContext.type == scriptContext.UserEventType.DELETE) {
          var recordOld = scriptContext.oldRecord;
          var recordId = recordOld.id;

          var country = recordOld.getText({
            fieldId: 'custbody_lmry_subsidiary_country'
          });

          if (country != '' && country != null) {
            country = country.substring(0, 3).toUpperCase();
          }
          var flag = validarPais(country);
          if (flag == true) {
            deleteAll(recordOld);
          }
        }
      } catch (err) {

        library.sendemail(' [ Before Submit ] ' + err, LMRY_script);
      }
    }

    /*********************************************************************************************************
     * Funcion que realiza el calculo de las retenciones o impuestos.
     * Para los 14 paises excepto BR: Llamada desde el User Event del Invoice, Credit Memo, Bill y Bill Credit
     * Para Brasil : Llamada desde el Cliente del Invoice, Sales Order y Estimate
     *               Llamada desde el User Event del Invoice, Sales Order y Estimate
     ********************************************************************************************************/
    function afterSubmitTransaction(scriptContext, isUret, typeClnt) {

      var recordObj = scriptContext.newRecord;
      try {
        var userObj = runtime.getCurrentUser();
        var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
        var featureMultiPrice = runtime.isFeatureInEffect({ feature: 'multprice' });

        var type = '';

        if (isUret) {
          type = scriptContext.type;
        } else {
          type = typeClnt;
        }

        if (type == 'create' || type == 'edit' || type == 'copy') {
          if (isUret) {
            recordId = scriptContext.newRecord.id;
            transactionType = scriptContext.newRecord.type;
            calcularIBPT(recordId, transactionType, recordObj);
          }
          if (!validateMemo(recordObj)) {
            return recordObj;
          }

          var recordId = '';
          var transactionType = '';
          var wtax_wcod = '';

          if (isUret) {
            recordId = scriptContext.newRecord.id;
            transactionType = scriptContext.newRecord.type;
            if (runtime.executionContext != 'MAPREDUCE') {
              if (["invoice", "creditmemo"].indexOf(transactionType) == -1) {

                recordObj = record.load({
                  type: transactionType,
                  id: recordId,
                  isDynamic: false
                });
              }
            } else {
              libraryWHT.deleteGeneratedRecords(recordObj);
            }

            wtax_wcod = scriptContext.newRecord.getValue({
              fieldId: 'custpage_4601_witaxcode'
            });
          } else {
            recordId = scriptContext.currentRecord.id;
            transactionType = scriptContext.currentRecord.type;
            recordObj = scriptContext.currentRecord;
            wtax_wcod = recordObj.getValue({
              fieldId: 'custpage_4601_witaxcode'
            });
          }

          if (recordObj.getValue('voided') == 'T') {
            return recordObj;
          }

          var country = recordObj.getText({
            fieldId: 'custbody_lmry_subsidiary_country'
          });

          var idCountry = recordObj.getValue({
            fieldId: 'custbody_lmry_subsidiary_country'
          });

          applyWHT = recordObj.getValue({
            fieldId: 'custbody_lmry_apply_wht_code'
          });

          var province = recordObj.getValue({
            fieldId: 'custbody_lmry_province'
          });

          var city = recordObj.getValue({
            fieldId: 'custbody_lmry_city'
          });

          var district = recordObj.getValue({
            fieldId: 'custbody_lmry_district'
          });

          idCountry = Number(idCountry);

          if (country != '' && country != null) {
            country = country.substring(0, 3).toUpperCase();
          }
          var flag = validarPais(country);
          if (flag == false) {
            return recordObj;
          }

          // Consulta el campo de Retenciones
          if (isUret == false && (wtax_wcod == '' || wtax_wcod == null)) { // Si es un CLNT y No tiene retenciones
            return recordObj;
          }

          var inventoryBR = true;
          if (idCountry == 30) {
            var catalog = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_service_catalog', line: 0 });
            if (catalog) {
              inventoryBR = false;
            }
          }

          if (type == 'edit' && ((idCountry == 30 && !inventoryBR) || idCountry != 30)) {
            deleteAll(recordObj);
          }

          var taxResults = [], licenses = [];

          var featureSubs = runtime.isFeatureInEffect({
            feature: "SUBSIDIARIES"
          });

          var fecha = recordObj.getText({
            fieldId: 'trandate'
          });
          var locationTransaction = recordObj.getValue({
            fieldId: 'location'
          });
          var subsidiary;
          if (featureSubs) {
            subsidiary = recordObj.getValue({
              fieldId: 'subsidiary'
            });
          } else {
            subsidiary = recordObj.getValue({
              fieldId: 'custbody_lmry_subsidiary_country'
            });
          }

          licenses = library.getLicenses(subsidiary);

          var entity = recordObj.getValue({
            fieldId: 'entity'
          });

          // Variable con el id de la transaccion que se enviara como filtro para la CC y NT
          var filtroTransactionType;
          switch (transactionType) {
            case 'invoice':
              filtroTransactionType = 1;
              break;
            case 'creditmemo':
              filtroTransactionType = 8;
              break;
            case 'vendorbill':
              filtroTransactionType = 4;
              break;
            case 'vendorcredit':
              filtroTransactionType = 7;
              break;
            case 'salesorder':
              filtroTransactionType = 2;
              break;
            case 'estimate':
              filtroTransactionType = 10;
              break;
            default:
              return recordObj;
          }

          var grossamt;
          var netamt;
          var taxamt = recordObj.getValue({
            fieldId: 'taxtotal'
          });
          if (taxamt == null || taxamt == '') {
            taxamt = 0;
          }
          if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 8 || filtroTransactionType == 10) { // Si es una transaccion de Ventas
            netamt = recordObj.getValue({
              fieldId: 'subtotal'
            });
            grossamt = parseFloat(netamt) + parseFloat(taxamt);
          } else { // Si es una transaccion de Compras
            grossamt = recordObj.getValue({
              fieldId: 'usertotal'
            });
            netamt = parseFloat(grossamt) - parseFloat(taxamt);
          }

          // Se redondean todos los montos a dos decimales
          netamt = parseFloat(Math.round(parseFloat(netamt) * 100) / 100);
          taxamt = parseFloat(Math.round(parseFloat(taxamt) * 100) / 100);
          grossamt = parseFloat(Math.round(parseFloat(grossamt) * 100) / 100);

          var grossamtInicial = grossamt;
          var netamtInicial = netamt;
          var taxamtInicial = taxamt;

          var documentType = recordObj.getValue({
            fieldId: 'custbody_lmry_document_type'
          });

          var retencLinesBR = 0;
          var retencion = 0;
          var baseAmount = 0;
          var compareAmount = 0;
          var cantidad_items = recordObj.getLineCount({
            sublistId: 'item'
          });

          var cantidad_expenses = 0;
          if (filtroTransactionType == 4 || filtroTransactionType == 7) { // Para Bill y Bill Credit
            cantidad_expenses = recordObj.getLineCount({
              sublistId: 'expense'
            });

          }

          /**********************************************************
           * Busqueda en el record: LatamReady - Setup Tax Subsidiary
           **********************************************************/
          var clasificacionCC = false;
          var acountCC = false;
          var rounding = '';
          var depSetup = '';
          var classSetup = '';
          var locSetup = '';
          var currencySetup = '';
          var journalForm = '';
          var taxCalculationForm = 1;
          var filterLoc = false;
          var filtros = new Array();
          filtros[0] = search.createFilter({
            name: 'isinactive',
            operator: 'is',
            values: ['F']
          });
          if (featureSubs) {
            filtros[1] = search.createFilter({
              name: 'custrecord_lmry_setuptax_subsidiary',
              operator: 'is',
              values: [subsidiary]
            });
          }
          var searchSetupSubsidiary = search.create({
            type: "customrecord_lmry_setup_tax_subsidiary",
            filters: filtros,
            columns: ['custrecord_lmry_setuptax_subsidiary', 'custrecord_lmry_setuptax_depclassloc', 'custrecord_lmry_setuptax_account', 'custrecord_lmry_setuptax_type_rounding', 'custrecord_lmry_setuptax_department', 'custrecord_lmry_setuptax_class', 'custrecord_lmry_setuptax_location', 'custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_form_journal', 'custrecord_lmry_setuptax_br_taxfromgross', 'custrecord_lmry_setuptax_br_filterloc']
          });
          var resultSearchSub = searchSetupSubsidiary.run().getRange({
            start: 0,
            end: 1000
          });

          if (resultSearchSub.length != null && resultSearchSub.length != '') {
            if (resultSearchSub.length > 0) {
              clasificacionCC = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_depclassloc'
              });
              acountCC = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_account'
              });
              rounding = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_type_rounding'
              });
              depSetup = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_department'
              });
              classSetup = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_class'
              });
              locSetup = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_location'
              });
              currencySetup = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_currency'
              });
              journalForm = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_form_journal'
              });
              taxCalculationForm = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_br_taxfromgross'
              });
              if (taxCalculationForm == '' || taxCalculationForm == null) {
                taxCalculationForm = 1;
              }
              filterLoc = resultSearchSub[0].getValue({
                name: 'custrecord_lmry_setuptax_br_filterloc'
              });
            }
          }

          // Si se debe filtrar por Location y el Location de la transaccion está vacio, no realiza el flujo
          if (filterLoc) {
            if (locationTransaction == '' || locationTransaction == null) {
              return recordObj;
            }
          }

          if (isUret == false && (taxCalculationForm == '2' || taxCalculationForm == '4')) { // si es un CLNT y parte del gross (flujo 1 y flujo 3)
            return recordObj;
          }

          /*******************************************************************************************
           * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
           *******************************************************************************************/
          var featureMB = runtime.isFeatureInEffect({
            feature: "MULTIBOOK"
          });
          var exchangeRate = 1;
          var currency = recordObj.getValue({
            fieldId: 'currency'
          });

          if (featureSubs && featureMB) { // OneWorld y Multibook
            var currencySubs = search.lookupFields({
              type: 'subsidiary',
              id: subsidiary,
              columns: ['currency']
            });
            currencySubs = currencySubs.currency[0].value;

            if (currencySubs != currencySetup && currencySetup != '' && currencySetup != null) {
              var lineasBook = recordObj.getLineCount({
                sublistId: 'accountingbookdetail'
              });
              if (lineasBook != null && lineasBook != '') {
                for (var i = 0; i < lineasBook; i++) {
                  var lineaCurrencyMB = recordObj.getSublistValue({
                    sublistId: 'accountingbookdetail',
                    fieldId: 'currency',
                    line: i
                  });
                  if (lineaCurrencyMB == currencySetup) {
                    exchangeRate = recordObj.getSublistValue({
                      sublistId: 'accountingbookdetail',
                      fieldId: 'exchangerate',
                      line: i
                    });
                    break;
                  }
                }
              }
            } else { // La moneda de la subsidiaria es igual a la moneda del setup
              exchangeRate = recordObj.getValue({
                fieldId: 'exchangerate'
              });
            }
          } else { // No es OneWorld o no tiene Multibook
            exchangeRate = recordObj.getValue({
              fieldId: 'exchangerate'
            });
          }
          exchangeRate = parseFloat(exchangeRate);


          //Se obtiene la concatenacion de los libros contables para Servicios/Inventory - Item. Para Sin Multibook 0&ExchangeRate
          var concatAccountBooks = concatenarAccountingBooks(recordObj, featureMB);

          var discountAmounts = getDiscountAmounts(recordObj);
          log.error("discountAmounts", JSON.stringify(discountAmounts));

          /*******************************************************************************
           * Blanquea las columnas Base Amount y Total Taxes de la transaccion para Brasil
           *******************************************************************************/
          //_CHANGE
          if (type == 'edit' || type == 'create' || type == 'copy') {
            if (country.toUpperCase() == 'BRA') {
              var hasCatalog = false;

              for (var i = 0; i < cantidad_items; i++) {
                var catalogAux = recordObj.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_lmry_br_service_catalog',
                  line: i
                });

                if (isUret == false) {
                  recordObj.selectLine('item', i);
                }

                if (catalogAux) {
                  hasCatalog = true;
                  if (taxCalculationForm == 3) { // Solo para el flujo 2
                    var netamtItem = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'amount',
                      line: i
                    });
                    netamtItem = parseFloat(Math.round(parseFloat(netamtItem) * 100) / 100);
                    var oldBaseAmount = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'custcol_lmry_br_base_amount',
                      line: i
                    });
                    oldBaseAmount = parseFloat(Math.round(parseFloat(oldBaseAmount) * 100) / 100);
                    var oldTotalImpuestos = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'custcol_lmry_br_total_impuestos',
                      line: i
                    });
                    oldTotalImpuestos = parseFloat(Math.round(parseFloat(oldTotalImpuestos) * 100) / 100);
                    var newNetAmount = parseFloat(parseFloat(netamtItem) - parseFloat(oldTotalImpuestos));
                    newNetAmount = parseFloat(Math.round(parseFloat(newNetAmount) * 100) / 100);
                    // Si el Net - Impuestos = Monto Base Antiguo
                    var lineCountDetail = recordObj.getLineCount({ sublistId: 'taxdetails' });
                    if( lineCountDetail > 0 && lineCountDetail ) {
                      recordObj.removeLine({ sublistId: 'taxdetails', line: 0 });
                    }
                    if (newNetAmount == oldBaseAmount) {
                      if (isUret) {
                        //('Flujo 2', 'URET sin retenciones');
                        recordObj.setSublistValue('item', 'amount', i, oldBaseAmount);
                        recordObj.setSublistValue('item', 'grossamt', i, oldBaseAmount);
                      } else {
                        //('Flujo 2', 'CLNT sin retenciones');
                        recordObj.setCurrentSublistValue('item', 'amount', oldBaseAmount);
                        recordObj.setCurrentSublistValue('item', 'grossamt', oldBaseAmount);
                      }
                    }
                  }
                  if (isUret) {
                    // Si es flujo 1 o 3 o no tiene retenciones
                    if ((taxCalculationForm == '2' || taxCalculationForm == '4') || (wtax_wcod == '' || wtax_wcod == null)) {
                      //('Flujo', 'URET 1/3 o sin retenciones');
                      recordObj.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_lmry_br_total_impuestos',
                        line: i,
                        value: ''
                      });
                    }
                  } else {
                    //('Flujo', 'CLNT');
                    recordObj.setCurrentSublistValue('item', 'custcol_lmry_br_total_impuestos', '');
                    recordObj.commitLine({
                      sublistId: 'item'
                    });
                  }
                }
              } // Fin for items

              if (!hasCatalog) {
                return recordObj;
              }


            } // Fin if Brazil
          } // Fin if type edit para blanqueado de campos Brazil

          var mvaRecords = {}, taxesToST = {}, stTaxes = {}, taxesNotIncluded = {};
          if (Number(taxCalculationForm) == 4) {
            mvaRecords = getmvaRecords(recordObj);
            log.error("mvaRecords", JSON.stringify(mvaRecords));
          }

          var sumaBaseCalculoT = 0;
          var sumaBaseCalculoI = 0;
          var blnBaseCalculoI = false;
          /********************************************************
           * Busqueda en el record: LatamReady - Contributory Class
           ********************************************************/
          var filtrosCC = [
            ['isinactive', 'is', 'F'], 'AND',
            ['custrecord_lmry_ar_ccl_fechdesd', 'onorbefore', fecha], 'AND',
            ['custrecord_lmry_ar_ccl_fechhast', 'onorafter', fecha], 'AND',
            ['custrecord_lmry_ccl_transactiontypes', 'anyof', filtroTransactionType], 'AND',
            ['custrecord_lmry_ar_ccl_entity', 'anyof', entity], 'AND',
            ['custrecord_lmry_ccl_appliesto', 'anyof', ["1", "2"]], 'AND',
            ['custrecord_lmry_ccl_taxtype', 'anyof', '4'], 'AND',
            ['custrecord_lmry_ccl_gen_transaction', 'anyof', '2']
          ];

          var documents = ['@NONE@'];
          if (documentType) {
            documents.push(documentType);
          }
          filtrosCC.push('AND', ['custrecord_lmry_ccl_fiscal_doctype', 'anyof', documents]);

          if (filterLoc) {
            filtrosCC.push('AND', ['custrecord_lmry_ar_ccl_location', 'anyof', locationTransaction]);
          }

          if (featureSubs) {
            filtrosCC.push('AND', ['custrecord_lmry_ar_ccl_subsidiary', 'anyof', subsidiary])
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

          filtrosCC.push('AND', [
            [
              ["custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "is", "F"]
            ]
            , "OR", [
              ["custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "is", "T"],
              'AND', ["custrecord_lmry_ccl_province", "anyof", provinces],
              'AND', ["custrecord_lmry_ccl_city", "anyof", cities],
              'AND', ["custrecord_lmry_ccl_district", "anyof", districts]
            ]
          ]);

          var searchCC = search.create({
            type: 'customrecord_lmry_ar_contrib_class',
            columns: [{
              name: "custrecord_lmry_ccl_appliesto",
              sort: search.Sort.ASC
            }, {
              name: "custrecord_lmry_br_ccl_catalog",
              sort: search.Sort.ASC
            }, {
              name: 'custrecord_lmry_br_exclusive',
              sort: search.Sort.ASC
            }, 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_amount', 'internalid', 'custrecord_lmry_sub_type', 'custrecord_lmry_ccl_minamount', 'custrecord_lmry_br_ccl_account1', 'custrecord_lmry_br_ccl_account2', 'custrecord_lmry_ccl_gen_transaction', 'custrecord_lmry_ar_ccl_department',
              'custrecord_lmry_ar_ccl_class', 'custrecord_lmry_ar_ccl_location', 'custrecord_lmry_ccl_applies_to_item', 'custrecord_lmry_ccl_applies_to_account', 'custrecord_lmry_ccl_addratio', 'custrecord_lmry_ccl_description', 'custrecord_lmry_ec_ccl_catalog', 'custrecord_lmry_ec_ccl_wht_taxcode',
              'custrecord_lmry_ec_ccl_rate_rpt', 'custrecord_lmry_ccl_maxamount', 'custrecord_lmry_ccl_accandmin_with', 'custrecord_lmry_ccl_not_taxable_minimum', 'custrecord_lmry_ccl_base_amount', 'custrecord_lmry_ccl_set_baseretention', 'custrecord_lmry_br_ccl_rate_suma', 'custrecord_lmry_br_receita',
              'custrecord_lmry_ar_ccl_isexempt', 'custrecord_lmry_br_taxsituation', 'custrecord_lmry_br_nature_revenue', "custrecord_lmry_sub_type.custrecord_lmry_tax_by_location",
              'custrecord_lmry_sub_type.custrecord_lmry_is_tax_not_included', 'custrecord_lmry_ccl_is_substitution',
              'custrecord_lmry_ar_ccl_taxitem', 'custrecord_lmry_ar_ccl_taxcode'],
            filters: filtrosCC
          });
          var searchResultCC = searchCC.run().getRange({
            start: 0,
            end: 1000
          });


          if (searchResultCC != null && searchResultCC.length > 0) {

            // Brasil : Calculo del Monto Base para el Flujo 0 y 2
            if (country.toUpperCase() == 'BRA' && (taxCalculationForm == 1 || taxCalculationForm == 3)) {
              var suma = parseFloat(sumaPorcentajes(searchResultCC, '1', 'custrecord_lmry_ccl_appliesto', 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_br_ccl_rate_suma', '', '', 'custrecord_lmry_sub_type'));
              grossamt = parseFloat(grossamtInicial / parseFloat(1 - suma));
              netamt = parseFloat(netamtInicial / parseFloat(1 - suma));
              taxamt = parseFloat(taxamtInicial / parseFloat(1 - suma));
            }

            for (var i = 0; i < searchResultCC.length; i++) {
              var internalIdCC = searchResultCC[i].getValue({
                name: 'internalid'
              });

              var taxrate = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ar_ccl_taxrate'
              });
              var amount_to = searchResultCC[i].getValue({
                name: 'custrecord_lmry_amount'
              });
              var applies_to = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_appliesto'
              });
              var subtype = searchResultCC[i].getText({
                name: 'custrecord_lmry_sub_type'
              });

              var subtype_id = searchResultCC[i].getValue({
                name: 'custrecord_lmry_sub_type'
              });

              var min_amount = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_minamount'
              });
              var account1 = searchResultCC[i].getValue({
                name: 'custrecord_lmry_br_ccl_account1'
              });
              var account2 = searchResultCC[i].getValue({
                name: 'custrecord_lmry_br_ccl_account2'
              });
              var genera = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_gen_transaction'
              });
              var department = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ar_ccl_department'
              });
              var classes = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ar_ccl_class'
              });
              var location = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ar_ccl_location'
              });
              var applies_item = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_applies_to_item'
              });
              var applies_account = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_applies_to_account'
              });
              var catalog_br = searchResultCC[i].getValue({
                name: 'custrecord_lmry_br_ccl_catalog'
              });
              var ratio = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_addratio'
              });
              var description = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_description'
              });
              var catalog_ec = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ec_ccl_catalog'
              });
              var wht_taxcode = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ec_ccl_wht_taxcode'
              });
              var rate_rpt = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ec_ccl_rate_rpt'
              });
              var max_amount = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_maxamount'
              });
              var amount_to_compare = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_accandmin_with'
              });
              var not_taxable_minimun = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_not_taxable_minimum'
              });
              var how_base_amount = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_base_amount'
              });
              var base_retention = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ccl_set_baseretention'
              });
              var is_exclusive = searchResultCC[i].getValue({
                name: 'custrecord_lmry_br_exclusive'
              });
              var receita = searchResultCC[i].getValue({
                name: 'custrecord_lmry_br_receita'
              });
              var isExempt = searchResultCC[i].getValue({
                name: 'custrecord_lmry_ar_ccl_isexempt'
              });
              var taxSituation = searchResultCC[i].getValue({
                name: 'custrecord_lmry_br_taxsituation'
              });
              var natureRevenue = searchResultCC[i].getValue({
                name: 'custrecord_lmry_br_nature_revenue'
              });

              var isTaxByLocation = searchResultCC[i].getValue({
                join: "custrecord_lmry_sub_type",
                name: "custrecord_lmry_tax_by_location"
              });

              var isTaxNotIncluded = searchResultCC[i].getValue({
                join: "custrecord_lmry_sub_type",
                name: "custrecord_lmry_is_tax_not_included"
              });

              var isSubstitutionTax = searchResultCC[i].getValue({
                name: "custrecord_lmry_ccl_is_substitution"
              });

              var taxItem = searchResultCC[i].getValue({
                name: "custrecord_lmry_ar_ccl_taxitem"
              });

              var taxCode = searchResultCC[i].getValue({
                name: "custrecord_lmry_ar_ccl_taxcode"
              });

              retencion = 0;
              baseAmount = 0;
              compareAmount = 0;

              // Conversion de los montos de la CC a moneda de la transaccion
              if (min_amount == null || min_amount == '') { // Entidad - Totales / Items - Minimo
                min_amount = 0;
              }
              min_amount = parseFloat(parseFloat(min_amount) / exchangeRate);
              if (max_amount == null || max_amount == '') { // Entidad - Totales / Items - Maximo
                max_amount = 0;
              }
              max_amount = parseFloat(parseFloat(max_amount) / exchangeRate);
              if (base_retention == null || base_retention == '') {
                base_retention = 0;
              }
              base_retention = parseFloat(parseFloat(base_retention) / exchangeRate);
              if (not_taxable_minimun == null || not_taxable_minimun == '') {
                not_taxable_minimun = 0;
              }
              not_taxable_minimun = parseFloat(parseFloat(not_taxable_minimun) / exchangeRate);

              if (ratio == null || ratio == '') {
                ratio = 1;
              }
              if (amount_to_compare == '' || amount_to_compare == null) {
                amount_to_compare = amount_to;
              }

              // Si es Suite GL y debe tomar las Cuentas de la CC y estas están vacias, continua con la siguiente iteracion
              if ((acountCC == 'T' || acountCC == true) || genera == '1') {
                if ((account1 == null || account1 == '') || (account2 == null || account2 == '')) {
                  continue;
                }
              }

              if (description == null || description == '') {
                description = '';
              }
              // Campos de Ecuador
              if (wht_taxcode == null || wht_taxcode == '') {
                wht_taxcode = '';
              }
              if (rate_rpt == null || rate_rpt == '') {
                rate_rpt = '';
              }

              if ((applyWHT == true || applyWHT == 'T') && (isTaxByLocation == true || isTaxByLocation == 'T')) {
                continue;
              }

              // Caso 1 : Entidad - Totales
              if (applies_to == 1) {

                if (country.toUpperCase() == 'BRA') {
                  if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Flujo 0 y 2
                    amount_to = '3'; // Trabaja con el Net Amount siempre
                    if ((is_exclusive == true || is_exclusive == 'T') && sumaBaseCalculoT > 0) {
                      grossamt = parseFloat(grossamt) - parseFloat(sumaBaseCalculoT);
                      netamt = parseFloat(netamt) - parseFloat(sumaBaseCalculoT);
                      taxamt = parseFloat(taxamt) - parseFloat(sumaBaseCalculoT);
                      sumaBaseCalculoT = 0;
                    }
                  } else { // Flujo 1 y 3
                    amount_to = '1'; // Trabaja con el Gross Amount siempre
                    if (taxCalculationForm == 4) {
                      if ((is_exclusive == true || is_exclusive == 'T') && sumaBaseCalculoT > 0) {
                        grossamt = parseFloat(grossamt) - parseFloat(sumaBaseCalculoT);
                        sumaBaseCalculoT = 0;
                      }
                    }
                  }
                }

                if (taxamt == 0 && amount_to == 2) {
                  continue;
                }
                // Calculo del Monto Base
                switch (amount_to) {
                  case '1':
                    baseAmount = parseFloat(grossamt) - parseFloat(not_taxable_minimun);
                    break;
                  case '2':
                    baseAmount = parseFloat(taxamt) - parseFloat(not_taxable_minimun);
                    break;
                  case '3':
                    baseAmount = parseFloat(netamt) - parseFloat(not_taxable_minimun);
                    break;
                }
                baseAmount = parseFloat(baseAmount); // Base Amount en Moneda de la Transaccion
                // Calculo del Monto a Comparar
                if (amount_to_compare == amount_to) {
                  compareAmount = parseFloat(baseAmount);
                } else {
                  switch (amount_to_compare) {
                    case '1':
                      compareAmount = parseFloat(grossamt);
                      break;
                    case '2':
                      compareAmount = parseFloat(taxamt);
                      break;
                    case '3':
                      compareAmount = parseFloat(netamt);
                      break;
                  }
                }

                if (how_base_amount != null && how_base_amount != '') {
                  switch (how_base_amount) {
                    case '2': // Substrac Minimun
                      baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                      break;
                    case '3': // Minimun
                      baseAmount = parseFloat(min_amount);
                      break;
                    case '4': // Maximun
                      baseAmount = parseFloat(max_amount);
                      break;

                  }
                }
                baseAmount = parseFloat(baseAmount);
                if (baseAmount <= 0) { // Si el Monto Base es menor o igual a 0
                  continue;
                }

                // Calculo de retencion
                if (max_amount != 0) {
                  if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                    retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                  }
                } else {
                  if (min_amount <= parseFloat(compareAmount)) {
                    retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                  }
                }

                if (parseFloat(retencion) > 0 || isExempt == true) {
                  var retencionAux = round2(retencion);
                  if (parseFloat(retencionAux) > 0 || isExempt == true) {
                    // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0 y 2
                    var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                    if (country.toUpperCase() == 'BRA' && (is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm)) != -1) {
                      sumaBaseCalculoT = sumaBaseCalculoT + parseFloat(retencionAux);
                    }

                    var localCurrBaseAmt = parseFloat(baseAmount);
                    var localCurrAmt = retencion;
                    if (exchangeRate != 1) {
                      localCurrBaseAmt = round2(baseAmount) * exchangeRate;
                      localCurrAmt = round2(retencion) * exchangeRate;
                    }

                    taxResults.push({
                      "subtype": subtype,
                      "subtypeId": subtype_id,
                      "lineuniquekey": "",
                      "baseAmount": parseFloat(baseAmount),
                      "amount": retencion,
                      "taxRecordId": internalIdCC,
                      "taxRate": parseFloat(taxrate),
                      "case": "1",
                      "account1": account1,
                      "account2": account2,
                      "genTrans": genera,
                      "department": department,
                      "class": classes,
                      "location": location,
                      "item": "",
                      "position": "",
                      "description": description,
                      "whtTaxCode": wht_taxcode,
                      "rateRpt": rate_rpt,
                      "receita": receita,
                      "taxSituation": taxSituation,
                      "natureRevenue": natureRevenue,
                      "localCurrBaseAmt": localCurrBaseAmt,
                      "localCurrAmt": localCurrAmt
                    });

                    blnTaxCalculate = true;
                  }
                } // Fin Retencion > 0
              } // Fin Caso 1 : Entidad - Totales

              // Caso 2I / 2E : Entidad - Items / Expenses
              else {

                // Caso 2I : Entidad - Items
                if ((country.toUpperCase() != 'BRA' && country.toUpperCase() != 'ECU' && applies_item != null && applies_item != '') ||
                  (country.toUpperCase() == 'BRA' && catalog_br != null && catalog_br != '') || (country.toUpperCase() == 'ECU' && catalog_ec != null && catalog_ec != '')) {
                  for (var j = 0; j < cantidad_items; j++) {
                    var idItem = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'item',
                      line: j
                    });

                    //Line Unique Key
                    var lineUniqueKey = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'lineuniquekey',
                      line: j
                    });

                    var typeDiscount = recordObj.getSublistValue({
                      sublistId: "item",
                      fieldId: "custcol_lmry_col_sales_type_discount",
                      line: j
                    });

                    var discountAmt = 0.00;
                    if (discountAmounts[String(j)]) {
                      discountAmt = discountAmounts[String(j)];
                    }

                    //Solo considera descuentos para los flujos 0 y 3 y para Descuento no condicional
                    if ([1, 4].indexOf(Number(taxCalculationForm)) == -1) {
                      discountAmt = 0;
                    }

                    var catalogItem = '';
                    var flagItem = false;

                    if (typeDiscount) {
                      continue;
                    }


                    switch (country.toUpperCase()) {
                      case 'BRA':
                        catalogItem = recordObj.getSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_lmry_br_service_catalog',
                          line: j
                        });
                        if (catalogItem == catalog_br) {
                          flagItem = true;
                        }
                        break;
                      case 'ECU':
                        catalogItem = recordObj.getSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_lmry_ec_concept_ret',
                          line: j
                        });
                        if (catalogItem == catalog_ec) {
                          flagItem = true;
                        }
                        break;
                      default:
                        if (idItem == applies_item) {
                          flagItem = true;
                        }
                        break;
                    }

                    var mcnCode = recordObj.getSublistValue({
                      sublistId: "item",
                      fieldId: "custcol_lmry_br_tran_mcn",
                      line: j
                    }) || "";

                    var isTaxItem = recordObj.getSublistValue({
                      sublistId: "item",
                      fieldId: "custcol_lmry_ar_item_tributo",
                      line: j
                    });

                    if (isTaxItem == "T" || isTaxItem == true) {
                      continue;
                    }

                    retencion = 0;
                    if (flagItem == true) {

                      if (Number(taxCalculationForm) == 4) {
                        if (isSubstitutionTax == "T" || isSubstitutionTax == true) {
                          var mvaList = getMVAByValues(mvaRecords, mcnCode, "", "", subtype_id, taxrate);
                          if (mvaList.length) {
                            for (var m = 0; m < mvaList.length; m++) {
                              var mvaId = mvaList[m]["mvaId"];
                              stTaxes[j] = stTaxes[j] || {};
                              stTaxes[j][mvaId] = stTaxes[j][mvaId] || [];
                              stTaxes[j][mvaId].push({
                                subType: subtype,
                                subTypeId: subtype_id,
                                taxRate: parseFloat(taxrate),
                                mvaRate: mvaRate,
                                taxRecordId: internalIdCC,
                                rateRpt: rate_rpt,
                                receita: receita,
                                taxSituation: taxSituation,
                                natureRevenue: natureRevenue,
                                taxItem: taxItem,
                                taxCode: taxCode
                              });
                            }
                          }
                          continue;
                        }
                      }

                      var grossamtItem = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'grossamt',
                        line: j
                      });
                      var taxamtItem = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxamount',
                        line: j
                      }) || 0.0;

                      var netamtItem = round2(parseFloat(grossamtItem) - parseFloat(taxamtItem));

                      if (taxamtItem == 0 && amount_to == 2) {
                        continue;
                      }

                      // Brasil : Calculo del Monto Base
                      if (country.toUpperCase() == 'BRA') {
                        if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Para el Flujo 0 y 2
                          amount_to = '3'; // Trabaja con el Net Amount siempre
                          var suma = parseFloat(sumaPorcentajes(searchResultCC, '2I', 'custrecord_lmry_ccl_appliesto', 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_br_ccl_rate_suma', 'custrecord_lmry_br_ccl_catalog', catalogItem, 'custrecord_lmry_sub_type'));
                          // Realiza la formula del Monto Base siguiendo la formula "Monto Base = Monto / (1 - suma de porcentajes)"

                          //Para flujo 0 y si tiene descuento no condicional
                          if (taxCalculationForm == 1) {
                            netamtItem = round2(netamtItem - discountAmt);
                          }

                          grossamtItem = parseFloat(grossamtItem / parseFloat(1 - suma));
                          taxamtItem = parseFloat(taxamtItem / parseFloat(1 - suma));
                          netamtItem = parseFloat(netamtItem / parseFloat(1 - suma));

                          if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                            var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                            // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                            grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                            netamtItem = parseFloat(netamtItem) - parseFloat(sumaBaseCalculoI);
                            taxamtItem = parseFloat(taxamtItem) - parseFloat(sumaBaseCalculoI);
                          }
                        } else { // Para el Flujo 1 y 3
                          amount_to = '1'; // Trabaja con el Gross Amount siempre
                          if (taxCalculationForm == 4) {

                            grossamtItem = round2(parseFloat(grossamtItem) - discountAmt);

                            if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                              var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                              //si es un impuesto de telecomunicaciones se resta al gross(monto base), la suma de los otros impuestos(PIS, COFINS..)
                              grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                            }
                          }
                        }
                      }

                      // Calculo del Monto Base
                      switch (amount_to) {
                        case '1':
                          baseAmount = parseFloat(grossamtItem) - parseFloat(not_taxable_minimun);
                          break;
                        case '2':
                          baseAmount = parseFloat(taxamtItem) - parseFloat(not_taxable_minimun);
                          break;
                        case '3':
                          baseAmount = parseFloat(netamtItem) - parseFloat(not_taxable_minimun);
                          break;
                      }
                      baseAmount = parseFloat(baseAmount);
                      // Calculo del Monto a Comparar
                      if (amount_to_compare == amount_to) {
                        compareAmount = parseFloat(baseAmount);
                      } else {
                        switch (amount_to_compare) {
                          case '1':
                            compareAmount = parseFloat(grossamtItem);
                            break;
                          case '2':
                            compareAmount = parseFloat(taxamtItem);
                            break;
                          case '3':
                            compareAmount = parseFloat(netamtItem);
                            break;
                        }
                      }

                      if (how_base_amount != null && how_base_amount != '') {
                        switch (how_base_amount) {
                          case '2': // Substrac Minimun
                            baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                            break;
                          case '3': // Minimun
                            baseAmount = parseFloat(min_amount);
                            break;
                          case '4': // Maximun
                            baseAmount = parseFloat(max_amount);
                            break;

                        }
                      }
                      baseAmount = parseFloat(baseAmount);
                      if (baseAmount <= 0) {
                        continue;
                      }

                      // Calculo de retencion
                      if (max_amount != 0) {
                        if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                          retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                        }
                      } else {
                        if (min_amount <= parseFloat(compareAmount)) {
                          retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                        }
                      }

                      if (parseFloat(retencion) > 0 || isExempt == true) {
                        var retencionAux = round2(retencion);
                        if (parseFloat(retencionAux) > 0 || isExempt == true) {
                          var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                          // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0, 2, 3
                          if ((is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm) != -1)) {
                            baseCalculoBR(parseFloat(retencionAux), j, true);
                          }

                          var localCurrBaseAmt = parseFloat(baseAmount);
                          var localCurrAmt = retencion;
                          var localCurrDiscAmt = discountAmt;

                          if (exchangeRate != 1) {
                            localCurrBaseAmt = round2(parseFloat(baseAmount)) * exchangeRate;
                            localCurrAmt = round2(retencion) * exchangeRate;
                            localCurrDiscAmt = round2(discountAmt) * exchangeRate;
                          }

                          if (Number(taxCalculationForm) == 4) {
                            if (isSubstitutionTax == "F" || isSubstitutionTax == false) {
                              var mvaList = getMVAByValues(mvaRecords, mcnCode, subtype_id, taxrate);
                              if (mvaList.length) {
                                taxesToST[j] = taxesToST[j] || {};
                                for (var m = 0; m < mvaList.length; m++) {
                                  var mvaId = mvaList[m]["mvaId"];
                                  var mvaRate = mvaList[m]["mvaRate"];
                                  taxesToST[j][mvaId] = taxesToST[j][mvaId] || [];
                                  taxesToST[j][mvaId].push({
                                    mvaRate: mvaRate,
                                    subType: subtype_id,
                                    taxRate: parseFloat(taxrate),
                                    taxRecordId: internalIdCC
                                  });
                                }
                              }
                            }


                            if (isTaxNotIncluded == "T" || isTaxNotIncluded == true) {
                              taxesNotIncluded[j] = taxesNotIncluded[j] || {};

                              if (!taxesNotIncluded[j][subtype_id]) {
                                taxesNotIncluded[j][subtype_id] = {
                                  amount: 0.00,
                                  subType: subtype,
                                  subTypeId: subtype_id
                                }
                              }

                              taxesNotIncluded[j][subtype_id]["amount"] = taxesNotIncluded[j][subtype_id]["amount"] + retencionAux;
                            }
                          }

                          taxResults.push({
                            "subtype": subtype,
                            "subtypeId": subtype_id,
                            "lineuniquekey": lineUniqueKey,
                            "baseAmount": parseFloat(baseAmount),
                            "amount": retencion,
                            "taxRecordId": internalIdCC,
                            "taxRate": parseFloat(taxrate),
                            "case": "2I",
                            "account1": account1,
                            "account2": account2,
                            "genTrans": genera,
                            "department": department,
                            "class": classes,
                            "location": location,
                            "item": idItem,
                            "position": j,
                            "description": description,
                            "whtTaxCode": wht_taxcode,
                            "rateRpt": rate_rpt,
                            "receita": receita,
                            "taxSituation": taxSituation,
                            "natureRevenue": natureRevenue,
                            "discountAmt": discountAmt,
                            "localCurrBaseAmt": localCurrBaseAmt,
                            "localCurrAmt": localCurrAmt,
                            "localCurrDiscAmt": localCurrDiscAmt,
                            "isSubstitutionTax": false,
                            "isTaxNotIncluded": isTaxNotIncluded,
                            "taxItem": taxItem,
                            "taxCode": taxCode
                          });


                          // Si es Brasil y No es Exento, llena la columna "LatamReady - BR Total Taxes" con la sumatoria de los impuestos calculados
                          if (country.toUpperCase() == 'BRA' && isExempt == false) {
                            var amount_Impuestos = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: j }) || 0.00;
                            amount_Impuestos = round2(amount_Impuestos);
                            var newAmount_Impuestos = round2(retencion);
                            newAmount_Impuestos = amount_Impuestos + newAmount_Impuestos;
                            newAmount_Impuestos = round2(newAmount_Impuestos);


                            if (isUret) {
                              // Si es Flujo 1 o 3 o no tiene retenciones
                              if ((taxCalculationForm == '2' || taxCalculationForm == '4') || (wtax_wcod == '' || wtax_wcod == null)) {
                                recordObj.setSublistValue({
                                  sublistId: 'item',
                                  fieldId: 'custcol_lmry_br_total_impuestos',
                                  line: j,
                                  value: newAmount_Impuestos
                                });
                              }
                            } else {
                              recordObj.selectLine('item', j);
                              recordObj.setCurrentSublistValue('item', 'custcol_lmry_br_total_impuestos', newAmount_Impuestos);
                              recordObj.commitLine({
                                sublistId: 'item'
                              });
                            }
                          } // Fin if BR y Exempt = false
                          blnTaxCalculate = true;
                        }
                      } // Fin Retencion > 0
                    } // Fin FlagItem = true
                  } // Fin For de Items
                } // Fin Caso 2I : Entidad - Items

                // Caso 2E : Entidad - Expenses
                if (filtroTransactionType == 4 || filtroTransactionType == 7) { // Bill - Bill Credit
                  if ((country.toUpperCase() != 'ECU' && applies_account != null && applies_account != '') || (country.toUpperCase() == 'ECU' && catalog_ec != null && catalog_ec != '')) {
                    for (var j = 0; j < cantidad_expenses; j++) {
                      var idAccount = recordObj.getSublistValue({
                        sublistId: 'expense',
                        fieldId: 'account',
                        line: j
                      });

                      var lineUniqueKey = recordObj.getSublistValue({
                        sublistId: 'expense',
                        fieldId: 'lineuniquekey',
                        line: j
                      });

                      retencion = 0;
                      var catalogExpense = '';
                      var flagExpense = false;

                      switch (country.toUpperCase()) {
                        case 'ECU':
                          catalogExpense = recordObj.getSublistValue({
                            sublistId: 'expense',
                            fieldId: 'custcol_lmry_ec_concept_ret',
                            line: j
                          });
                          if (catalogExpense == catalog_ec) {
                            flagExpense = true;
                          }
                          break;
                        default:
                          if (idAccount == applies_account) {
                            flagExpense = true;
                          }
                          break;
                      }

                      if (flagExpense == true) {
                        var grossamtItem = recordObj.getSublistValue({
                          sublistId: 'expense',
                          fieldId: 'grossamt',
                          line: j
                        });
                        var taxamtItem = recordObj.getSublistValue({
                          sublistId: 'expense',
                          fieldId: 'taxamount',
                          line: j
                        }) || 0.0;
                        var netamtItem = round2(parseFloat(grossamtItem) - parseFloat(taxamtItem));

                        if (taxamtItem == 0 && amount_to == 2) {
                          continue;
                        }

                        // Calculo del Monto Base
                        switch (amount_to) {
                          case '1':
                            baseAmount = parseFloat(grossamtItem) - parseFloat(not_taxable_minimun);
                            break;
                          case '2':
                            baseAmount = parseFloat(taxamtItem) - parseFloat(not_taxable_minimun);
                            break;
                          case '3':
                            baseAmount = parseFloat(netamtItem) - parseFloat(not_taxable_minimun);
                            break;
                        }
                        baseAmount = parseFloat(baseAmount);
                        // Calculo del Monto a Comparar
                        if (amount_to_compare == amount_to) {
                          compareAmount = parseFloat(baseAmount);
                        } else {
                          switch (amount_to_compare) {
                            case '1':
                              compareAmount = parseFloat(grossamtItem);
                              break;
                            case '2':
                              compareAmount = parseFloat(taxamtItem);
                              break;
                            case '3':
                              compareAmount = parseFloat(netamtItem);
                              break;
                          }
                        }

                        if (how_base_amount != null && how_base_amount != '') {
                          switch (how_base_amount) {
                            case '2': // Substrac Minimun
                              baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                              break;
                            case '3': // Minimun
                              baseAmount = parseFloat(min_amount);
                              break;
                            case '4': // Maximun
                              baseAmount = parseFloat(max_amount);
                              break;

                          }
                        }
                        baseAmount = parseFloat(baseAmount);
                        if (baseAmount <= 0) {
                          continue;
                        }

                        // Calculo de retencion
                        if (max_amount != 0) {
                          if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                            retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                          }
                        } else {
                          if (min_amount <= parseFloat(compareAmount)) {
                            retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                          }
                        }

                        if (parseFloat(retencion) > 0) {
                          var retencionAux = round2(retencion);
                          if (parseFloat(retencionAux) > 0) {
                            var localCurrBaseAmt = parseFloat(baseAmount);
                            var localCurrAmt = retencion;

                            if (exchangeRate != 1) {
                              localCurrBaseAmt = round2(parseFloat(baseAmount)) * exchangeRate;
                              localCurrAmt = round2(retencion) * exchangeRate;
                            }

                            taxResults.push({
                              "subtype": subtype,
                              "subtypeId": subtype_id,
                              "lineuniquekey": lineUniqueKey,
                              "baseAmount": parseFloat(baseAmount),
                              "amount": retencion,
                              "taxRecordId": internalIdCC,
                              "taxRate": parseFloat(taxrate),
                              "case": "2E",
                              "account1": account1,
                              "account2": account2,
                              "genTrans": genera,
                              "department": department,
                              "class": classes,
                              "location": location,
                              "item": idAccount,
                              "position": j,
                              "description": description,
                              "whtTaxCode": wht_taxcode,
                              "rateRpt": rate_rpt,
                              "receita": receita,
                              "taxSituation": taxSituation,
                              "natureRevenue": natureRevenue,
                              "localCurrBaseAmt": localCurrBaseAmt,
                              "localCurrAmt": localCurrAmt,
                            });
                          }
                        } // Fin Retencion > 0
                      } // Fin FlagExpense = true
                    } // Fin for Expenses
                  }
                } // Fin Caso 2E : Entidad - Expenses
              } // Fin Caso 2I / 2E : Entidad - Items / Expenses
            } // Fin For CC
          } // Fin if CC != null

          /********************************************
           * Consulta de Impuestos Exentos para Brasil
           *******************************************/
          var filtroExemptBR = '';
          if (country.toUpperCase() == 'BRA') {
            filtroExemptBR = exemptTaxBR(entity);
          }

          // Inicializa las variables para Brasil
          sumaBaseCalculoT = 0;
          sumaBaseCalculoI = 0;
          blnBaseCalculoI = false;
          arreglo_SumaBaseBR = new Array();
          arreglo_IndiceBaseBR = new Array();

          /****************************************************
           * Busqueda en el record: LatamReady - National Taxes
           ****************************************************/
          var filtrosNT = [
            ["isinactive", "is", "F"], "AND",
            ["custrecord_lmry_ntax_datefrom", "onorbefore", fecha], "AND",
            ["custrecord_lmry_ntax_dateto", "onorafter", fecha], "AND",
            ["custrecord_lmry_ntax_transactiontypes", "anyof", filtroTransactionType], "AND",
            ["custrecord_lmry_ntax_taxtype", "anyof", "4"], "AND",
            ["custrecord_lmry_ntax_appliesto", "anyof", ["1", "2"]], "AND",
            ["custrecord_lmry_ntax_gen_transaction", "anyof", "2"]
          ];

          var documents = ['@NONE@'];
          if (documentType) {
            documents.push(documentType);
          }

          filtrosNT.push("AND", ["custrecord_lmry_ntax_fiscal_doctype", "anyof", documents]);

          if (filterLoc) {
            filtrosNT.push("AND", ["custrecord_lmry_ntax_location", "anyof", locationTransaction]);
          }

          if (featureSubs) {
            filtrosNT.push("AND", ["custrecord_lmry_ntax_subsidiary", "anyof", subsidiary])
          }

          if (filtroExemptBR) {
            filtrosNT.push("AND", ["custrecord_lmry_ntax_sub_type", "noneof", filtroExemptBR])
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

          filtrosNT.push('AND', [
            [
              ["custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "is", "F"]
            ]
            , "OR", [
              ["custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "is", "T"],
              "AND", ["custrecord_lmry_ntax_province", "anyof", provinces],
              "AND", ["custrecord_lmry_ntax_city", "anyof", cities],
              "AND", ["custrecord_lmry_ntax_district", "anyof", districts]
            ]
          ]);


          var searchNT = search.create({
            type: 'customrecord_lmry_national_taxes',
            columns: [{
              name: "custrecord_lmry_ntax_appliesto",
              sort: search.Sort.ASC
            }, {
              name: "custrecord_lmry_ntax_catalog",
              sort: search.Sort.ASC
            }, {
              name: 'custrecord_lmry_br_ntax_exclusive',
              sort: search.Sort.ASC
            }, 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_ntax_amount', 'internalid', 'custrecord_lmry_ntax_sub_type', 'custrecord_lmry_ntax_minamount', 'custrecord_lmry_ntax_debit_account', 'custrecord_lmry_ntax_credit_account', 'custrecord_lmry_ntax_gen_transaction', 'custrecord_lmry_ntax_department',
              'custrecord_lmry_ntax_class', 'custrecord_lmry_ntax_location', 'custrecord_lmry_ntax_applies_to_item', 'custrecord_lmry_ntax_applies_to_account', 'custrecord_lmry_ntax_addratio', 'custrecord_lmry_ntax_description', 'custrecord_lmry_ec_ntax_catalog', 'custrecord_lmry_ec_ntax_wht_taxcode',
              'custrecord_lmry_ec_ntax_rate_rpt', 'custrecord_lmry_ntax_maxamount', 'custrecord_lmry_ntax_accandmin_with', 'custrecord_lmry_ntax_not_taxable_minimum', 'custrecord_lmry_ntax_base_amount', 'custrecord_lmry_ntax_set_baseretention', 'custrecord_lmry_br_ntax_rate_suma', 'custrecord_lmry_ntax_br_receita', 'custrecord_lmry_ntax_isexempt',
              'custrecord_lmry_br_ntax_tax_situation', 'custrecord_lmry_br_ntax_nature_revenue',
              'custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location',
              'custrecord_lmry_ntax_sub_type.custrecord_lmry_is_tax_not_included', 'custrecord_lmry_nt_is_substitution',
              'custrecord_lmry_ntax_taxitem', 'custrecord_lmry_ntax_taxcode'
            ],
            filters: filtrosNT
          });
          var searchResultNT = searchNT.run().getRange({
            start: 0,
            end: 1000
          });


          if (searchResultNT != null && searchResultNT.length > 0) {

            // Brasil : Calculo del Monto Base para el Flujo 0 y 2
            if (country.toUpperCase() == 'BRA' && (taxCalculationForm == 1 || taxCalculationForm == 3)) {
              var suma = parseFloat(sumaPorcentajes(searchResultNT, '1', 'custrecord_lmry_ntax_appliesto', 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_br_ntax_rate_suma', '', '', 'custrecord_lmry_ntax_sub_type'));
              grossamt = parseFloat(grossamtInicial / parseFloat(1 - suma));
              netamt = parseFloat(netamtInicial / parseFloat(1 - suma));
              taxamt = parseFloat(taxamtInicial / parseFloat(1 - suma));
            }

            for (var i = 0; i < searchResultNT.length; i++) {
              var internalIdNT = searchResultNT[i].getValue({
                name: 'internalid'
              });
              var taxrate = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_taxrate'
              });
              var amount_to = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_amount'
              });
              var applies_to = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_appliesto'
              });
              var subtype = searchResultNT[i].getText({
                name: 'custrecord_lmry_ntax_sub_type'
              });

              var subtype_id = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_sub_type'
              });
              var min_amount = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_minamount'
              });
              var account1 = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_debit_account'
              });
              var account2 = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_credit_account'
              });
              var genera = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_gen_transaction'
              });
              var department = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_department'
              });
              var classes = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_class'
              });
              var location = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_location'
              });
              var applies_item = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_applies_to_item'
              });
              var applies_account = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_applies_to_account'
              });
              var catalog_br = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_catalog'
              });
              var ratio = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_addratio'
              });
              var description = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_description'
              });
              var catalog_ec = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ec_ntax_catalog'
              });
              var wht_taxcode = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ec_ntax_wht_taxcode'
              });
              var rate_rpt = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ec_ntax_rate_rpt'
              });
              var max_amount = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_maxamount'
              });
              var amount_to_compare = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_accandmin_with'
              });
              var not_taxable_minimun = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_not_taxable_minimum'
              });
              var how_base_amount = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_base_amount'
              });
              var base_retention = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_set_baseretention'
              });
              var is_exclusive = searchResultNT[i].getValue({
                name: 'custrecord_lmry_br_ntax_exclusive'
              });
              var receita = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_br_receita'
              });
              var isExempt = searchResultNT[i].getValue({
                name: 'custrecord_lmry_ntax_isexempt'
              });
              var taxSituation = searchResultNT[i].getValue({
                name: 'custrecord_lmry_br_ntax_tax_situation'
              });
              var natureRevenue = searchResultNT[i].getValue({
                name: 'custrecord_lmry_br_ntax_nature_revenue'
              });

              var isTaxByLocation = searchResultNT[i].getValue({
                join: "custrecord_lmry_ntax_sub_type",
                name: "custrecord_lmry_tax_by_location"
              });

              var isTaxNotIncluded = searchResultNT[i].getValue({
                join: "custrecord_lmry_ntax_sub_type",
                name: "custrecord_lmry_is_tax_not_included"
              });

              var isSubstitutionTax = searchResultNT[i].getValue({
                name: "custrecord_lmry_nt_is_substitution"
              });

              var taxItem = searchResultNT[i].getValue({
                name: "custrecord_lmry_ntax_taxitem"
              });

              var taxCode = searchResultNT[i].getValue({
                name: "custrecord_lmry_ntax_taxcode"
              });

              retencion = 0;
              baseAmount = 0;
              compareAmount = 0;

              // Conversion de los montos de la CC a moneda de la transaccion
              if (min_amount == null || min_amount == '') { // Subsidiaria - Totales / Items - Minimo
                min_amount = 0;
              }
              min_amount = parseFloat(parseFloat(min_amount) / exchangeRate);

              if (max_amount == null || max_amount == '') { // Subsidiaria - Totales / Items - Maximo
                max_amount = 0;
              }
              max_amount = parseFloat(parseFloat(max_amount) / exchangeRate);
              if (base_retention == null || base_retention == '') {
                base_retention = 0;
              }
              base_retention = parseFloat(parseFloat(base_retention) / exchangeRate);
              if (not_taxable_minimun == null || not_taxable_minimun == '') {
                not_taxable_minimun = 0;
              }
              not_taxable_minimun = parseFloat(parseFloat(not_taxable_minimun) / exchangeRate);

              if (ratio == null || ratio == '') {
                ratio = 1;
              }
              if (amount_to_compare == '' || amount_to_compare == null) {
                amount_to_compare = amount_to;
              }


              // Si es Suite GL y debe tomar las Cuentas de la CC y estas están vacias, continua con la siguiente iteracion
              if ((acountCC == 'T' || acountCC == true) || genera == '1') {
                if ((account1 == null || account1 == '') || (account2 == null || account2 == '')) {
                  continue;
                }
              }

              if (description == null || description == '') {
                description = '';
              }
              // Campos de Ecuador
              if (wht_taxcode == null || wht_taxcode == '') {
                wht_taxcode = '';
              }
              if (rate_rpt == null || rate_rpt == '') {
                rate_rpt = '';
              }

              if ((applyWHT == true || applyWHT == 'T') && (isTaxByLocation == true || isTaxByLocation == 'T')) {
                continue;
              }

              // Caso 3 : Subsidiaria - Totales
              if (applies_to == 1) {

                if (country.toUpperCase() == 'BRA') {
                  if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Flujo 0 y 2
                    amount_to = '3'; // Trabaja con el Net Amount siempre
                    if ((is_exclusive == true || is_exclusive == 'T') && sumaBaseCalculoT > 0) {
                      grossamt = parseFloat(grossamt) - parseFloat(sumaBaseCalculoT);
                      netamt = parseFloat(netamt) - parseFloat(sumaBaseCalculoT);
                      taxamt = parseFloat(taxamt) - parseFloat(sumaBaseCalculoT);
                      sumaBaseCalculoT = 0;
                    }
                  } else { // Flujo 1 y 3
                    amount_to = '1'; // Trabaja con el Gross Amount siempre
                    if (taxCalculationForm == 4) {
                      if ((is_exclusive == true || is_exclusive == 'T') && sumaBaseCalculoT > 0) {
                        grossamt = parseFloat(grossamt) - parseFloat(sumaBaseCalculoT);
                        sumaBaseCalculoT = 0;
                      }
                    }
                  }
                }

                if (taxamt == 0 && amount_to == 2) {
                  continue;
                }

                // Calculo del Monto Base
                switch (amount_to) {
                  case '1':
                    baseAmount = parseFloat(grossamt) - parseFloat(not_taxable_minimun);
                    break;
                  case '2':
                    baseAmount = parseFloat(taxamt) - parseFloat(not_taxable_minimun);
                    break;
                  case '3':
                    baseAmount = parseFloat(netamt) - parseFloat(not_taxable_minimun);
                    break;
                }
                baseAmount = parseFloat(baseAmount);
                // Calculo del Monto a Comparar
                if (amount_to_compare == amount_to) {
                  compareAmount = parseFloat(baseAmount);
                } else {
                  switch (amount_to_compare) {
                    case '1':
                      compareAmount = parseFloat(grossamt);
                      break;
                    case '2':
                      compareAmount = parseFloat(taxamt);
                      break;
                    case '3':
                      compareAmount = parseFloat(netamt);
                      break;
                  }
                }

                if (how_base_amount != null && how_base_amount != '') {
                  switch (how_base_amount) {
                    case '2': // Substrac Minimun
                      baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                      break;
                    case '3': // Minimun
                      baseAmount = parseFloat(min_amount);
                      break;
                    case '4': // Maximun
                      baseAmount = parseFloat(max_amount);
                      break;

                  }
                }
                baseAmount = parseFloat(baseAmount);
                if (baseAmount <= 0) {
                  continue;
                }

                // Calculo de retencion
                if (max_amount != 0) {
                  if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                    retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                  }
                } else {
                  if (min_amount <= parseFloat(compareAmount)) {
                    retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                  }
                }

                if (parseFloat(retencion) > 0 || isExempt == true) {
                  var retencionAux = round2(retencion);
                  if (parseFloat(retencionAux) > 0 || isExempt == true) {
                    // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0 y 2
                    var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                    if (country.toUpperCase() == 'BRA' && (is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm)) != -1) {
                      sumaBaseCalculoT = sumaBaseCalculoT + parseFloat(retencionAux);
                    }

                    var localCurrBaseAmt = parseFloat(baseAmount);
                    var localCurrAmt = retencion;
                    if (exchangeRate != 1) {
                      localCurrBaseAmt = round2(parseFloat(baseAmount)) * exchangeRate;
                      localCurrAmt = round2(retencion) * exchangeRate;
                    }

                    taxResults.push({
                      "subtype": subtype,
                      "subtypeId": subtype_id,
                      "lineuniquekey": "",
                      "baseAmount": parseFloat(baseAmount),
                      "amount": retencion,
                      "taxRecordId": internalIdNT,
                      "taxRate": parseFloat(taxrate),
                      "case": "3",
                      "account1": account1,
                      "account2": account2,
                      "genTrans": genera,
                      "department": department,
                      "class": classes,
                      "location": location,
                      "item": "",
                      "position": "",
                      "description": description,
                      "whtTaxCode": wht_taxcode,
                      "rateRpt": rate_rpt,
                      "receita": receita,
                      "taxSituation": taxSituation,
                      "natureRevenue": natureRevenue,
                      "localCurrBaseAmt": localCurrBaseAmt,
                      "localCurrAmt": localCurrAmt
                    });

                    blnTaxCalculate = true;
                  }
                } // Fin retencion > 0
              } // Fin Caso 1 : Subsidiaria - Totales

              // Caso 4I / 4E : Subsidiaria - Items / Expenses
              else {

                // Caso 4I : Subsidiaria - Items
                if ((country.toUpperCase() != 'BRA' && country.toUpperCase() != 'ECU' && applies_item != null && applies_item != '') ||
                  (country.toUpperCase() == 'BRA' && catalog_br != null && catalog_br != '') || (country.toUpperCase() == 'ECU' && catalog_ec != null && catalog_ec != '')) {
                  for (var j = 0; j < cantidad_items; j++) {
                    var idItem = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'item',
                      line: j
                    });

                    var lineUniqueKey = recordObj.getSublistValue({
                      sublistId: 'item',
                      fieldId: 'lineuniquekey',
                      line: j
                    });

                    var typeDiscount = recordObj.getSublistValue({
                      sublistId: "item",
                      fieldId: "custcol_lmry_col_sales_type_discount",
                      line: j
                    });

                    var discountAmt = 0.00;
                    if (discountAmounts[String(j)]) {
                      discountAmt = discountAmounts[String(j)];
                    }

                    //Solo considera descuentos para los flujos 0 y 3 y para Descuento no condicional
                    if ([1, 4].indexOf(Number(taxCalculationForm)) == -1) {
                      discountAmt = 0;
                    }

                    var catalogItem = '';
                    var flagItem = false;


                    if (typeDiscount) {
                      continue;
                    }

                    switch (country.toUpperCase()) {
                      case 'BRA':
                        catalogItem = recordObj.getSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_lmry_br_service_catalog',
                          line: j
                        });
                        if (catalogItem == catalog_br) {
                          flagItem = true;
                        }
                        break;
                      case 'ECU':
                        catalogItem = recordObj.getSublistValue({
                          sublistId: 'item',
                          fieldId: 'custcol_lmry_ec_concept_ret',
                          line: j
                        });
                        if (catalogItem == catalog_ec) {
                          flagItem = true;
                        }
                        break;
                      default:
                        if (idItem == applies_item) {
                          flagItem = true;
                        }
                        break;
                    }

                    var mcnCode = recordObj.getSublistValue({
                      sublistId: "item",
                      fieldId: "custcol_lmry_br_tran_mcn",
                      line: j
                    }) || "";

                    var isTaxItem = recordObj.getSublistValue({
                      sublistId: "item",
                      fieldId: "custcol_lmry_ar_item_tributo",
                      line: j
                    });

                    if (isTaxItem == "T" || isTaxItem == true) {
                      continue;
                    }

                    retencion = 0;
                    if (flagItem == true) {

                      if (Number(taxCalculationForm) == 4) {
                        if (isSubstitutionTax == "T" || isSubstitutionTax == true) {
                          var mvaList = getMVAByValues(mvaRecords, mcnCode, "", "", subtype_id, taxrate);
                          if (mvaList.length) {
                            for (var m = 0; m < mvaList.length; m++) {
                              var mvaId = mvaList[m]["mvaId"];
                              stTaxes[j] = stTaxes[j] || {};
                              stTaxes[j][mvaId] = stTaxes[j][mvaId] || [];
                              stTaxes[j][mvaId].push({
                                subType: subtype,
                                subTypeId: subtype_id,
                                taxRate: parseFloat(taxrate),
                                mvaRate: mvaRate,
                                taxRecordId: internalIdCC,
                                receita: receita,
                                taxSituation: taxSituationItem,
                                natureRevenue: natureRevenue,
                                regimen: regimenItem,
                                taxItem: taxItem,
                                taxCode: taxCode
                              });
                            }
                          }
                          continue;
                        }
                      }

                      var grossamtItem = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'grossamt',
                        line: j
                      });

                      var taxamtItem = recordObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxamount',
                        line: j
                      }) || 0.0;
                      var netamtItem = round2(parseFloat(grossamtItem) - parseFloat(taxamtItem));

                      if (taxamtItem == 0 && amount_to == 2) {
                        continue;
                      }

                      // Brasil : Calculo del Monto Base
                      if (country.toUpperCase() == 'BRA') {
                        if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Para el Flujo 0 y 2
                          amount_to = '3'; // Trabaja con el Net Amount siempre
                          var suma = parseFloat(sumaPorcentajes(searchResultNT, '2I', 'custrecord_lmry_ntax_appliesto', 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_br_ntax_rate_suma', 'custrecord_lmry_ntax_catalog', catalogItem, 'custrecord_lmry_ntax_sub_type'));
                          // Realiza la formula del Monto Base siguiendo la formula "Monto Base = Monto / (1 - suma de porcentajes)"

                          //Para flujo 0 y si tiene descuento no condicional
                          if (taxCalculationForm == 1) {
                            netamtItem = round2(netamtItem - discountAmt);
                          }

                          grossamtItem = parseFloat(grossamtItem / parseFloat(1 - suma));
                          taxamtItem = parseFloat(taxamtItem / parseFloat(1 - suma));
                          netamtItem = parseFloat(netamtItem / parseFloat(1 - suma));

                          if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                            var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                            // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                            grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                            netamtItem = parseFloat(netamtItem) - parseFloat(sumaBaseCalculoI);
                            taxamtItem = parseFloat(taxamtItem) - parseFloat(sumaBaseCalculoI);
                          }
                        } else { // Para el Flujo 1 y 3
                          amount_to = '1'; // Trabaja con el Gross Amount siempre
                          if (taxCalculationForm == 4) {

                            grossamtItem = round2(parseFloat(grossamtItem) - discountAmt);
                            if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                              var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                              //si es un impuesto de telecomunicaciones se resta al gross(monto base), la suma de los otros impuestos(PIS, COFINS..)
                              grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                            }
                          }
                        }
                      }

                      // Calculo del Monto Base
                      switch (amount_to) {
                        case '1':
                          baseAmount = parseFloat(grossamtItem) - parseFloat(not_taxable_minimun);
                          break;
                        case '2':
                          baseAmount = parseFloat(taxamtItem) - parseFloat(not_taxable_minimun);
                          break;
                        case '3':
                          baseAmount = parseFloat(netamtItem) - parseFloat(not_taxable_minimun);
                          break;
                      }
                      baseAmount = parseFloat(baseAmount);
                      // Calculo del Monto a Comparar
                      if (amount_to_compare == amount_to) {
                        compareAmount = parseFloat(baseAmount);
                      } else {
                        switch (amount_to_compare) {
                          case '1':
                            compareAmount = parseFloat(grossamtItem);
                            break;
                          case '2':
                            compareAmount = parseFloat(taxamtItem);
                            break;
                          case '3':
                            compareAmount = parseFloat(netamtItem);
                            break;
                        }
                      }

                      if (how_base_amount != null && how_base_amount != '') {
                        switch (how_base_amount) {
                          case '2': // Substrac Minimun
                            baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                            break;
                          case '3': // Minimun
                            baseAmount = parseFloat(min_amount);
                            break;
                          case '4': // Maximun
                            baseAmount = parseFloat(max_amount);
                            break;

                        }
                      }
                      baseAmount = parseFloat(baseAmount);
                      if (baseAmount <= 0) {
                        continue;
                      }

                      // Calculo de retencion
                      if (max_amount != 0) {
                        if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                          retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                        }
                      } else {
                        if (min_amount <= parseFloat(compareAmount)) {
                          retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                        }
                      }

                      if (parseFloat(retencion) > 0 || isExempt == true) {
                        var retencionAux = round2(retencion);
                        if (parseFloat(retencionAux) > 0 || isExempt == true) {
                          var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                          // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0, 2, 3
                          if ((is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm) != -1)) {
                            baseCalculoBR(parseFloat(retencionAux), j, true);
                          }

                          var localCurrBaseAmt = parseFloat(baseAmount);
                          var localCurrAmt = retencion;
                          var localCurrDiscAmt = discountAmt;
                          if (exchangeRate != 1) {
                            localCurrBaseAmt = round2(parseFloat(baseAmount)) * exchangeRate;
                            localCurrAmt = round2(retencion) * exchangeRate;
                            localCurrDiscAmt = round2(discountAmt) * exchangeRate;
                          }

                          if (Number(taxCalculationForm) == 4) {
                            if (isSubstitutionTax == "F" || isSubstitutionTax == false) {
                              var mvaList = getMVAByValues(mvaRecords, mcnCode, subtype_id, taxrate);
                              if (mvaList.length) {
                                taxesToST[j] = taxesToST[j] || {};
                                for (var m = 0; m < mvaList.length; m++) {
                                  var mvaId = mvaList[m]["mvaId"];
                                  var mvaRate = mvaList[m]["mvaRate"];
                                  taxesToST[j][mvaId] = taxesToST[j][mvaId] || [];
                                  taxesToST[j][mvaId].push({
                                    mvaRate: mvaRate,
                                    subType: subtype_id,
                                    taxRate: parseFloat(taxrate),
                                    taxRecordId: internalIdCC
                                  });
                                }
                              }
                            }

                            if (isTaxNotIncluded == "T" || isTaxNotIncluded == true) {
                              taxesNotIncluded[j] = taxesNotIncluded[j] || {};

                              if (!taxesNotIncluded[j][subtype_id]) {
                                taxesNotIncluded[j][subtype_id] = {
                                  amount: 0.00,
                                  subType: subtype,
                                  subTypeId: subtype_id
                                }
                              }

                              taxesNotIncluded[j][subtype_id]["amount"] = taxesNotIncluded[j][subtype_id]["amount"] + retencionAux;
                            }
                          }

                          taxResults.push({
                            "subtype": subtype,
                            "subtypeId": subtype_id,
                            "lineuniquekey": lineUniqueKey,
                            "baseAmount": parseFloat(baseAmount),
                            "amount": retencion,
                            "taxRecordId": internalIdNT,
                            "taxRate": parseFloat(taxrate),
                            "case": "4I",
                            "account1": account1,
                            "account2": account2,
                            "genTrans": genera,
                            "department": department,
                            "class": classes,
                            "location": location,
                            "item": idItem,
                            "position": j,
                            "description": description,
                            "whtTaxCode": wht_taxcode,
                            "rateRpt": rate_rpt,
                            "receita": receita,
                            "taxSituation": taxSituation,
                            "natureRevenue": natureRevenue,
                            "discountAmt": discountAmt,
                            "localCurrBaseAmt": localCurrBaseAmt,
                            "localCurrAmt": localCurrAmt,
                            "localCurrDiscAmt": localCurrDiscAmt,
                            "isSubstitutionTax": false,
                            "isTaxNotIncluded": isTaxNotIncluded,
                            "taxItem": taxItem,
                            "taxCode": taxCode
                          });

                          // Si es Brasil y No es Exento, llena la columna "LatamReady - BR Total Taxes" con la sumatoria de los impuestos calculados
                          if (country.toUpperCase() == 'BRA' && isExempt == false) {
                            var amount_Impuestos = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: j }) || 0.00;
                            amount_Impuestos = round2(amount_Impuestos);
                            var newAmount_Impuestos = round2(retencion);
                            newAmount_Impuestos = amount_Impuestos + newAmount_Impuestos;
                            newAmount_Impuestos = round2(newAmount_Impuestos);


                            if (isUret) {
                              // Si es Flujo 1 o 3 o no tiene retenciones
                              if ((taxCalculationForm == '2' || taxCalculationForm == '4') || (wtax_wcod == '' || wtax_wcod == null)) {
                                //('Flujo', 'URET 1/3 o Sin retenciones');
                                recordObj.setSublistValue({
                                  sublistId: 'item',
                                  fieldId: 'custcol_lmry_br_total_impuestos',
                                  line: j,
                                  value: newAmount_Impuestos
                                });
                              }
                            } else {
                              //('Flujo', 'CLNT');
                              recordObj.selectLine('item', j);
                              recordObj.setCurrentSublistValue('item', 'custcol_lmry_br_total_impuestos', newAmount_Impuestos);
                              recordObj.commitLine({
                                sublistId: 'item'
                              });
                            }
                          } // Fin if BR y Exempt = false
                          blnTaxCalculate = true;
                        }
                      } // Fin Retencion > 0
                    } // Fin FlagItem = true
                  } // Fin For de Items
                } // Fin Caso 4I : Subsidiaria - Items

                // Caso 4E : Subsidiaria - Expenses
                if (filtroTransactionType == 4 || filtroTransactionType == 7) { // Bill - Bill Credit
                  if ((country.toUpperCase() != 'ECU' && applies_account != null && applies_account != '') || (country.toUpperCase() == 'ECU' && catalog_ec != null && catalog_ec != '')) {
                    for (var j = 0; j < cantidad_expenses; j++) {
                      var idAccount = recordObj.getSublistValue({
                        sublistId: 'expense',
                        fieldId: 'account',
                        line: j
                      });

                      var lineUniqueKey = recordObj.getSublistValue({
                        sublistId: 'expense',
                        fieldId: 'lineuniquekey',
                        line: j
                      });

                      var catalogExpense = '';
                      var flagExpense = false;

                      switch (country.toUpperCase()) {
                        case 'ECU':
                          catalogExpense = recordObj.getSublistValue({
                            sublistId: 'expense',
                            fieldId: 'custcol_lmry_ec_concept_ret',
                            line: j
                          });
                          if (catalogExpense == catalog_ec) {
                            flagExpense = true;
                          }
                          break;
                        default:
                          if (idAccount == applies_account) {
                            flagExpense = true;
                          }
                          break;
                      }
                      retencion = 0;

                      if (flagExpense == true) {
                        var grossamtItem = recordObj.getSublistValue({
                          sublistId: 'expense',
                          fieldId: 'grossamt',
                          line: j
                        });
                        var taxamtItem = recordObj.getSublistValue({
                          sublistId: 'expense',
                          fieldId: 'taxamount',
                          line: j
                        }) || 0.0;
                        var netamtItem = round2(parseFloat(grossamtItem) - parseFloat(taxamtItem));

                        if (taxamtItem == 0 && amount_to == 2) {
                          continue;
                        }

                        // Calculo del Monto Base
                        switch (amount_to) {
                          case '1':
                            baseAmount = parseFloat(grossamtItem) - parseFloat(not_taxable_minimun);
                            break;
                          case '2':
                            baseAmount = parseFloat(taxamtItem) - parseFloat(not_taxable_minimun);
                            break;
                          case '3':
                            baseAmount = parseFloat(netamtItem) - parseFloat(not_taxable_minimun);
                            break;
                        }
                        baseAmount = parseFloat(baseAmount);
                        // Calculo del Monto a Comparar
                        if (amount_to_compare == amount_to) {
                          compareAmount = parseFloat(baseAmount);
                        } else {
                          switch (amount_to_compare) {
                            case '1':
                              compareAmount = parseFloat(grossamtItem);
                              break;
                            case '2':
                              compareAmount = parseFloat(taxamtItem);
                              break;
                            case '3':
                              compareAmount = parseFloat(netamtItem);
                              break;
                          }
                        }

                        if (how_base_amount != null && how_base_amount != '') {
                          switch (how_base_amount) {
                            case '2': // Substrac Minimun
                              baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                              break;
                            case '3': // Minimun
                              baseAmount = parseFloat(min_amount);
                              break;
                            case '4': // Maximun
                              baseAmount = parseFloat(max_amount);
                              break;

                          }
                        }
                        baseAmount = parseFloat(baseAmount);
                        if (baseAmount <= 0) {
                          continue;
                        }

                        // Calculo de retencion
                        if (max_amount != 0) {
                          if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                            retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                          }
                        } else {
                          if (min_amount <= parseFloat(compareAmount)) {
                            retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                          }
                        }

                        if (parseFloat(retencion) > 0) {
                          var retencionAux = round2(retencion);
                          if (parseFloat(retencionAux) > 0) {

                            var localCurrBaseAmt = parseFloat(baseAmount);
                            var localCurrAmt = retencion;
                            if (exchangeRate != 1) {
                              localCurrBaseAmt = round2(parseFloat(baseAmount)) * exchangeRate;
                              localCurrAmt = round2(retencion) * exchangeRate;
                            }


                            taxResults.push({
                              "subtype": subtype,
                              "subtypeId": subtype_id,
                              "lineuniquekey": lineUniqueKey,
                              "baseAmount": parseFloat(baseAmount),
                              "amount": retencion,
                              "taxRecordId": internalIdNT,
                              "taxRate": parseFloat(taxrate),
                              "case": "4E",
                              "account1": account1,
                              "account2": account2,
                              "genTrans": genera,
                              "department": department,
                              "class": classes,
                              "location": location,
                              "item": idAccount,
                              "position": j,
                              "description": description,
                              "whtTaxCode": wht_taxcode,
                              "rateRpt": rate_rpt,
                              "receita": receita,
                              "taxSituation": taxSituation,
                              "natureRevenue": natureRevenue,
                              "localCurrBaseAmt": localCurrBaseAmt,
                              "localCurrAmt": localCurrAmt
                            });

                          }
                        } // Fin Retencion > 0
                      } // Fin FlagExpense = true
                    } // Fin for Expenses
                  }
                } // Fin Caso 4E : Entidad - Expenses
              } //Fin Caso 4 : Subsidiaria - Items
            } // Fin for NT
          } // Fin if NT != null


          if (Number(taxCalculationForm) == 4) {
            log.error("taxesToST", JSON.stringify(taxesToST));
            log.error("stTaxes", JSON.stringify(stTaxes));
            log.error("taxesNotIncluded", JSON.stringify(taxesNotIncluded));

            calculateSubstitutionTaxes(recordObj, taxesToST, stTaxes, taxesNotIncluded, taxResults, exchangeRate);
            addTaxItems(recordObj, taxResults, depSetup, classSetup, locSetup);
          }

          log.error("taxResults", JSON.stringify(taxResults));

          // Variables de Preferencias Generales
          var prefDep = userObj.getPreference({
            name: "DEPTMANDATORY"
          });
          var prefLoc = userObj.getPreference({
            name: "LOCMANDATORY"
          });
          var prefClas = userObj.getPreference({
            name: "CLASSMANDATORY"
          });

          var sumatoria = 0;
          var amounts = {};
          /*************************************************************************************
           * Si es Brasil, actualiza los montos de linea de la transaccion dependiendo del flujo
           *************************************************************************************/
          if (country.toUpperCase() == 'BRA') {

            var auxArray = [];
            for (var i = 0; i < taxResults.length; i++) {
              auxArray.push({
                uniquekey: taxResults[i].lineuniquekey,
                baseamount: taxResults[i].baseAmount,
                taxrate: taxResults[i].taxRate
              });
            }
            var tr_details = getTaxResultDetails (auxArray);
            var searchObj = search.create({
              type: 'salestaxitem',
              columns: [{
                name: 'internalid'
              }, {
                name: 'name'
              }, {
                name: 'internalid',
                join: 'taxType'
              }],
              filters: [
               ["taxtype.country","anyof","BR"],
               "AND",
               ["taxtype.isinactive","is","F"],
               "AND",
               ["taxtype.doesnotaddtototal","is","F"],
               "AND",
               ["taxtype.name","is","VAT_BR"],
               "AND",
               ["name","startswith","UNDEF"],
               "AND",
               ["isinactive","is","F"]
             ]
           }).run().getRange(0, 10);

           var searchColumns = searchObj[0].columns;
           var taxCode = searchObj[0].getValue(searchColumns[0]);
           var taxType = searchObj[0].getValue(searchColumns[2]);

            for (var i = 0; i < cantidad_items; i++) {
              var totalTaxItem = recordObj.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_lmry_br_total_impuestos',
                line: i
              });
              if (totalTaxItem == '' || totalTaxItem == null) {
                totalTaxItem = 0;
              }
              totalTaxItem = parseFloat(totalTaxItem);
              var netamtItem = recordObj.getSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                line: i
              });
              netamtItem = parseFloat(netamtItem);
              var quantityItem = recordObj.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: i
              });
              quantityItem = parseFloat(quantityItem);

              var isItemTax = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_ar_item_tributo', line: i });
              var typeDiscount = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_col_sales_type_discount', line: i });

              if ((!isItemTax || isItemTax == 'F') && !typeDiscount &&
                (totalTaxItem > 0 || blnTaxCalculate == true) && netamtItem > 0) {

                  var taxDetailsLines = recordObj.getLineCount({ sublistId: 'taxdetails' });
                  if( i == 0 && taxDetailsLines > 0 ) {

                    for( var j = 0; j < taxDetailsLines; j++ ) {
                      recordObj.removeLine({ sublistId: 'taxdetails', line: 0 });
                    }
                    var values = setTaxDetailLines( tr_details, taxCalculationForm, recordObj, i, totalTaxItem, featureMultiPrice, sumatoria, taxCode, taxType );
                    sumatoria = parseFloat( values.sum );
                    amounts[String(i)] = values.amt;

                  } else {
                    var values = setTaxDetailLines( tr_details, taxCalculationForm, recordObj, taxDetailsLines, totalTaxItem, featureMultiPrice, sumatoria, taxCode, taxType );
                    sumatoria = parseFloat( values.sum );
                    amounts[String(taxDetailsLines)] = values.amt;
                  }

              }
            }

            log.error("amounts", JSON.stringify(amounts));

            if (isUret) { // Si es Flujo 1 o 3 o no tiene retenciones

              if (runtime.executionContext != 'MAPREDUCE') {
                if (transactionType == 'creditmemo') {
                  var transactionId = recordObj.getValue('createdfrom');
                  var numberApply = recordObj.getLineCount('apply');
                  for (var i = 0; i < numberApply; i++) {
                    var lineId = recordObj.getSublistValue('apply', 'internalid', i);
                    if (Number(lineId) == transactionId) {
                      recordObj.setSublistValue('apply', 'apply', i, true);
                    }
                  }
                }

                if (["invoice", "creditmemo"].indexOf(transactionType) == -1) {
                  recordObj.save({ ignoreMandatoryFields: true, disableTriggers: true, enableSourcing: true });
                }
              }
            }
          }

          /****************************************************************************
           * Agrega las lineas al record LatamReady - Tax Results y genera los Journals
           ****************************************************************************/
          //Feature Create Tax Results
          // saveTaxResult(taxResults, recordObj.id, recordObj.getValue('trandate'), subsidiary, idCountry);
          if (isUret && library.getAuthorization(596, licenses)) {
            for (var i = 0; i < taxResults.length; i++) {
              var taxResult = taxResults[i];
              var recordSummary = record.create({
                type: 'customrecord_lmry_br_transaction',
                isDynamic: false
              });
              var idTransaction = parseFloat(recordId);
              idTransaction = idTransaction + "";

              recordSummary.setValue({
                fieldId: 'custrecord_lmry_br_related_id',
                value: idTransaction
              });
              recordSummary.setValue({
                fieldId: 'custrecord_lmry_br_transaction',
                value: idTransaction
              });
              recordSummary.setValue({
                fieldId: 'custrecord_lmry_br_type',
                value: taxResult["subtype"]
              });

              if (taxResult["subtypeId"]) {
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_br_type_id',
                  value: taxResult["subtypeId"]
                });
              }
              recordSummary.setValue({
                fieldId: 'custrecord_lmry_base_amount',
                value: round4(taxResult["baseAmount"])
              });
              recordSummary.setValue({
                fieldId: 'custrecord_lmry_br_total',
                value: round4(taxResult["amount"])
              });
              recordSummary.setValue({
                fieldId: 'custrecord_lmry_br_percent',
                value: taxResult["taxRate"]
              });
              switch (taxResult["case"]) {
                case '1': // Entidad - Totales
                case '3': // Subsidiaria - Totales
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_total_item',
                    value: 'Total'
                  });
                  break;
                case '2I': // Entidad - Items
                case '4I': // Subsidiaria - Items
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_total_item',
                    value: 'Line - Item'
                  });
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_item',
                    value: taxResult["item"]
                  });
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_br_positem',
                    value: parseInt(taxResult["position"])
                  });

                  //Line Unique Key
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_lineuniquekey',
                    value: parseInt(taxResult["lineuniquekey"])
                  });

                  break;
                case '2E': // Entidad - Expenses
                case '4E': // Subsidiaria - Expenses
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_total_item',
                    value: 'Line - Expense'
                  });
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_account',
                    value: taxResult["item"]
                  });
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_br_positem',
                    value: parseInt(taxResult["position"])
                  });
                  //Line Unique Key
                  recordSummary.setValue({
                    fieldId: 'custrecord_lmry_lineuniquekey',
                    value: parseInt(taxResult["lineuniquekey"])
                  });

                  break;
              }

              if (["1", "2I", "2E"].indexOf(taxResult["case"]) != -1) { // Entidad - Totales || Entidad - Items || Entidad - Expenses
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_ccl',
                  value: taxResult["taxRecordId"]
                });
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_br_ccl',
                  value: taxResult["taxRecordId"]
                });
              } else { // Subsidiaria - Totales || Subsidiaria - Items || Subsidiaria - Expenses
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_ntax',
                  value: taxResult["taxRecordId"]
                });
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_br_ccl',
                  value: taxResult["taxRecordId"]
                });
              }

              recordSummary.setValue({
                fieldId: 'custrecord_lmry_accounting_books',
                value: concatAccountBooks
              });

              recordSummary.setValue({
                fieldId: 'custrecord_lmry_tax_description',
                value: taxResult["description"] || ""
              });

              recordSummary.setValue({
                fieldId: 'custrecord_lmry_ec_wht_taxcode',
                value: taxResult["whtTaxCode"] || ""
              });

              recordSummary.setValue({
                fieldId: 'custrecord_lmry_ec_rate_rpt',
                value: taxResult["rateRpt"] || ""
              });

              recordSummary.setValue({
                fieldId: 'custrecord_lmry_total_base_currency',
                value: round4(taxResult["localCurrAmt"])
              });

              if (country.toUpperCase() == 'BRA') {
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_tax_type',
                  value: '4'
                });
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_br_receta',
                  value: taxResult["receita"]
                });
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_br_tax_taxsituation',
                  value: taxResult["taxSituation"]
                });
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_br_tax_nature_revenue',
                  value: taxResult["natureRevenue"]
                });
              } else {
                recordSummary.setValue({
                  fieldId: 'custrecord_lmry_tax_type',
                  value: '1'
                });
              }

              var position = String(taxResult["position"]);
              if (amounts[position]) {
                recordSummary.setValue({ fieldId: "custrecord_lmry_gross_amt", value: parseFloat(amounts[position]["grossAmt"]) });
              }
              if (taxResult["discountAmt"]) {
                recordSummary.setValue({ fieldId: "custrecord_lmry_discount_amt", value: taxResult["discountAmt"] });
              }
              if (taxResult["localCurrBaseAmt"]) {
                recordSummary.setValue({ fieldId: "custrecord_lmry_base_amount_local_currc", value: taxResult["localCurrBaseAmt"] });
              }
              if (taxResult["localCurrAmt"]) {
                recordSummary.setValue({ fieldId: "custrecord_lmry_amount_local_currency", value: taxResult["localCurrAmt"] })
              }

              if (amounts[position]) {
                var grossAmt = parseFloat(amounts[position]["grossAmt"]);
                if (exchangeRate != 1) {
                  grossAmt = grossAmt * exchangeRate;
                }
                recordSummary.setValue({ fieldId: "custrecord_lmry_gross_amt_local_curr", value: grossAmt });
              }

              if (taxResult["localCurrDiscAmt"]) {
                recordSummary.setValue({ fieldId: "custrecord_lmry_discount_amt_local_curr", value: taxResult["localCurrDiscAmt"] });
              }

              if (taxResult["isSubstitutionTax"]) {
                recordSummary.setValue({ fieldId: "custrecord_lmry_is_substitution_tax_resu", value: taxResult["isSubstitutionTax"] });
              }

              recordSummary.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
                disableTriggers: true
              });
            } // Fin For arreglo de retenciones
          } // Fin If isUret

          if (runtime.executionContext != 'MAPREDUCE') {
            set_EI_TelecommunicationsTaxes(recordObj);
          }

        } // Fin If create, edit o copy
      } catch (err) {
        library.sendemail(' [ After Submit ] ' + err, LMRY_script);
      }

      return recordObj;
    }

    function saveTaxResult(taxResult, transactionID, transactionDate, transactionSubsidiary, transactionCountry) {
      try {
        var TR_JSON_Search = search.create({
          type: "customrecord_lmry_ste_json_result",
          columns: [ "internalId" ],
          filters: [
            [ "custrecord_lmry_ste_related_transaction", "IS", transactionID ]
          ]
        }).run().getRange(0, 10);

        if (TR_JSON_Search != null && TR_JSON_Search.length) {
          var TR_JSON_InternalID = TR_JSON_Search[0].getValue({ name: "internalid" });
          record.submitFields({
            type: "customrecord_lmry_ste_json_result",
            id: TR_JSON_InternalID,
            values: {
              custrecord_lmry_ste_subsidiary: transactionSubsidiary,
              custrecord_lmry_ste_subsidiary_country: transactionCountry,
              custrecord_lmry_ste_tax_transaction: JSON.stringify(taxResult),
              custrecord_lmry_ste_transaction_date: transactionDate
            },
            options: {
              ignoreMandatoryFields: true,
              disableTriggers: true,
              enableSourcing: true
            }
          });
        } else {
          var TR_JSON_Record = record.create({
            type: "customrecord_lmry_ste_json_result",
            isDynamic: false
          });
          TR_JSON_Record.setValue({ fieldId: "custrecord_lmry_ste_related_transaction", value: transactionID });
          TR_JSON_Record.setValue({ fieldId: "custrecord_lmry_ste_subsidiary", value: transactionSubsidiary });
          TR_JSON_Record.setValue({ fieldId: "custrecord_lmry_ste_subsidiary_country", value: transactionCountry });
          TR_JSON_Record.setValue({ fieldId: "custrecord_lmry_ste_transaction_date", value: transactionDate });
          TR_JSON_Record.setValue({ fieldId: "custrecord_lmry_ste_tax_transaction", value: JSON.stringify(taxResult) });
          TR_JSON_Record.save({
            ignoreMandatoryFields: true,
            disableTriggers: true,
            enableSourcing: true
          });
        }
      } catch (e) {
        library.sendemail(' [ saveTaxResult ] ' + e, LMRY_script);
      }
    }

    /**************************************************************************************************
     * Funcion que permite agregar lineas al Tax Deatils
     **************************************************************************************************/
     function setTaxDetailLines( tr_details, taxCalculationForm, recordObj, itemLine, taxAmount, featureMultiPrice, sumatoria, taxCode, taxType ) {

       try {

         var taxDetailsReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: itemLine });
         var quantityItem = parseFloat( recordObj.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: itemLine }));
         var amountItem = parseFloat( recordObj.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: itemLine }));
         var grossItem = parseFloat( recordObj.getSublistValue({ sublistId: 'item', fieldId: 'grossamt', line: itemLine }));
         var uniqueKeyItem = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: itemLine });

         switch ( taxCalculationForm ) {

           case '1':

             var grossAmountItem = amountItem + taxAmount;

             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: itemLine, value: taxDetailsReference });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: itemLine, value: taxType });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: itemLine, value: taxCode });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: itemLine, value: tr_details[uniqueKeyItem].baseamount });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: itemLine, value: parseFloat( tr_details[uniqueKeyItem].taxrate ) });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: itemLine, value: taxAmount });

             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: itemLine, value: parseFloat( Math.round( parseFloat( amountItem ) * 100 ) / 100 ) });
             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: itemLine, value: parseFloat( Math.round( parseFloat( taxAmount ) * 100 ) / 100 ) });

             return {
               sum: sumatoria + grossAmountItem,
               amt: { "netAmt": amountItem, "taxAmt": taxAmount, "grossAmt": grossAmountItem }
             };

             break;

           case '2':

             amountItem = parseFloat( grossItem - taxAmount );
             var rateItem = parseFloat( amountItem / quantityItem );

             if( featureMultiPrice == true || featureMultiPrice == 'T' ) {
               recordObj.setSublistValue({ sublistId: 'item', fieldId: 'price', line: itemLine, value: -1 });
             }

             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: itemLine, value: taxDetailsReference });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: itemLine, value: taxType });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: itemLine, value: taxCode });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: itemLine, value: grossItem });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: itemLine, value: parseFloat( tr_details[uniqueKeyItem].taxrate ) });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: itemLine, value: taxAmount });

             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: itemLine, value: parseFloat( Math.round( parseFloat( rateItem ) * 100) / 100) });
             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: itemLine, value: parseFloat( Math.round( parseFloat( amountItem ) * 100) / 100) });
             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: itemLine, value: parseFloat(Math.round(parseFloat(grossItem) * 100) / 100) });
             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: itemLine, value: parseFloat(Math.round(parseFloat(taxAmount) * 100) / 100) });

             return{
               sum: sumatoria + grossItem,
               amt: { "netAmt": amountItem, "taxAmt": taxAmount, "grossAmt": grossItem }
             };

             break;

           case '3':

             if( featureMultiPrice == true || featureMultiPrice == 'T' ) {
               recordObj.setSublistValue({ sublistId: 'item', fieldId: 'price', line: itemLine, value: -1 });
             }

             amountItem = parseFloat( grossItem + taxAmount );
             var rateItem = parseFloat( amountItem / quantityItem );

             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: itemLine, value: taxDetailsReference });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: itemLine, value: taxType });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: itemLine, value: taxCode });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: itemLine, value: tr_details[uniqueKeyItem].baseamount });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: itemLine, value: parseFloat( tr_details[uniqueKeyItem].taxrate ) });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: itemLine, value: 0.0 });

             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: itemLine, value: parseFloat( Math.round( parseFloat( rateItem ) * 100) / 100) });
             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: itemLine, value: parseFloat( Math.round( parseFloat( amountItem ) * 100) / 100) });
             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: itemLine, value: parseFloat(Math.round(parseFloat(grossItem) * 100) / 100) });
             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: itemLine, value: parseFloat(Math.round(parseFloat(taxAmount) * 100) / 100) });

             return {
               sum: sumatoria + amountItem,
               amt: { "netAmt": amountItem, "taxAmt": 0.0, "grossAmt": amountItem }
             };

             break;

           case '4':

             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: itemLine, value: taxDetailsReference });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxtype', line: itemLine, value: taxType });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode', line: itemLine, value: taxCode });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxbasis', line: itemLine, value: tr_details[uniqueKeyItem].baseamount });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate', line: itemLine, value: parseFloat( tr_details[uniqueKeyItem].taxrate ) });
             recordObj.setSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: itemLine, value: 0.0 });

             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: itemLine, value: parseFloat(Math.round(parseFloat(grossItem) * 100) / 100) });
             recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_total_impuestos', line: itemLine, value: parseFloat(Math.round(parseFloat(taxAmount) * 100) / 100) });

             return {
               sum: sumatoria + grossItem,
               amt: { "netAmt": grossItem, "taxAmt": 0.0, "grossAmt": grossItem }
             };

             break;

         }

       } catch(e) {
         log.error('[ aftersubmit - setTaxDetailLines ]', e);
       }

     }

     function getTaxResultDetails( array_json ) {

       try {

         var a = [];
         for( var i = 0; i < array_json.length; i++ ) {
           a.push(array_json[i].uniquekey);
         }

         for( var i = a.length - 1; i >= 0; i-- ) {
           if( a.indexOf( a[i] ) !== i ){
             a.splice(i,1);
           }
         }

         var tr_json = {};
         for( var i = 0; i < a.length; i++ ) {
           var aux = [];
           var sumTaxRate = 0;
           for( var j = 0; j < array_json.length; j++ ) {
             if( a[i] === array_json[j].uniquekey ) {
               aux.push(j);
               sumTaxRate += array_json[j].taxrate;
             }
           }
           tr_json[a[i]] = {
             baseamount: array_json[aux[0]].baseamount,
             taxrate: sumTaxRate * 100
           };
         }

         return tr_json;

       } catch (e) {
         log.error('[ aftersubmit - getTaxResultDetails ]', e);
       }

     }

    /********************************************************
         * Funcion que realiza el cálculo de los tributos
         aproximados
         * Parámetros :
         *      recordId : ID de la transacción
         *      transactionType : Tipo de transacción
         *      recordObj : Objeto de la transacción
         ********************************************************/

    function calcularIBPT(recordId, transactionType, recordObj) {
      try {

        var idCountry = recordObj.getValue({ fieldId: 'custbody_lmry_subsidiary_country' });
        var fecha = recordObj.getValue({ fieldId: "trandate" });
        fecha = format.format({ value: fecha, type: format.Type.DATE });
        log.error("fecha", fecha);

        //Suma de tributos aproximados Federal Nacional
        var sumFedNac = 0;
        //Suma de tributos aproximados Federal Importación
        var sumFedImp = 0;
        //Suma de tributos aproximados Estadual
        var sumEst = 0;
        //Suma de tributos aproximados Municipal
        var sumMun = 0;
        var inventoryBR = true;
        var code = '';
        var band = false;
        var exchangeRate = 1;

        if (idCountry == 30 && transactionType == 'invoice') {

          var cantidad_items = recordObj.getLineCount({ sublistId: 'item' });
          exchangeRate = calcularExchangeRate(recordObj);

          for (var i = 0; i < cantidad_items; i++) {
            var catalogAux = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_service_catalog', line: i });
            var netamtItem = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
            var baseAmount = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_base_amount', line: i });

            if (baseAmount) {
              netamtItem = parseFloat(Math.round(parseFloat(baseAmount) * 100) / 100);
            } else {
              netamtItem = parseFloat(Math.round(parseFloat(netamtItem) * 100) / 100);
            }

            if (catalogAux) {
              var cod_catalog_search = search.lookupFields({
                type: 'customrecord_lmry_br_catalog_item',
                id: catalogAux,
                columns: ['custrecord_lmry_br_catalog_law_item']
              });

              var cod_catalog = cod_catalog_search.custrecord_lmry_br_catalog_law_item;
              code = cod_catalog.replace(/\./g, '');

            }

            if (code) {
              var filtros = [
                ["isinactive", "is", "F"], "AND",
                ["custrecord_lmry_ibpt_date_from", "onorbefore", fecha], "AND",
                ["custrecord_lmry_ibpt_date_to", "onorafter", fecha], "AND",
                ["name", "is", code]
              ];

              var searchIBPT = search.create({
                type: 'customrecord_lmry_br_ibpt',
                columns: ['custrecord_lmry_ibpt_porc_fed_nac', 'custrecord_lmry_ibpt_porc_fed_imp', 'custrecord_lmry_ibpt_porc_est', 'custrecord_lmry_ibpt_porc_mun'],
                filters: filtros
              });

              var resultIBPT = searchIBPT.run().getRange(0, 1);

              if (resultIBPT != null && resultIBPT.length > 0) {
                band = true;
                var row = resultIBPT[0].columns;
                //Porcentaje Federal Nacional
                var porc_fed_nac = resultIBPT[0].getValue(row[0]);
                porc_fed_nac = porc_fed_nac + '';
                porc_fed_nac = porc_fed_nac.split('%')[0];
                var monto_fed_nac = parseFloat(netamtItem) * parseFloat(exchangeRate) * (parseFloat(porc_fed_nac) / 100);
                sumFedNac = parseFloat(sumFedNac) + parseFloat(Math.round(parseFloat(monto_fed_nac) * 100) / 100);

                //Porcentaje Federal de Importación
                var porc_fed_imp = resultIBPT[0].getValue(row[1]);
                porc_fed_imp = porc_fed_imp + '';
                porc_fed_imp = porc_fed_imp.split('%')[0];
                var monto_fed_imp = parseFloat(netamtItem) * parseFloat(exchangeRate) * (parseFloat(porc_fed_imp) / 100);
                sumFedImp = parseFloat(sumFedImp) + parseFloat(Math.round(parseFloat(monto_fed_imp) * 100) / 100);

                //Porcentaje Estadual
                var porc_est = resultIBPT[0].getValue(row[2]);
                porc_est = porc_est + '';
                porc_est = porc_est.split('%')[0];
                var monto_est = parseFloat(netamtItem) * parseFloat(exchangeRate) * (parseFloat(porc_est) / 100);
                sumEst = parseFloat(sumEst) + parseFloat(Math.round(parseFloat(monto_est) * 100) / 100);

                //Porcentaje Municipal
                var porc_mun = resultIBPT[0].getValue(row[3]);
                porc_mun = porc_mun + '';
                porc_mun = porc_mun.split('%')[0];
                var monto_mun = parseFloat(netamtItem) * parseFloat(exchangeRate) * (parseFloat(porc_mun) / 100);
                sumMun = parseFloat(sumMun) + parseFloat(Math.round(parseFloat(monto_mun) * 100) / 100);
              }
            }
          } // Fin for items

          if (band) {
            //Seteo de campos en el Transaction fields
            var searchTransFields = search.create({
              type: 'customrecord_lmry_br_transaction_fields',
              columns: ['internalid', 'custrecord_lmry_br_trib_fed_nac', 'custrecord_lmry_br_trib_fed_imp', 'custrecord_lmry_br_trib_est', 'custrecord_lmry_br_trib_mun'],
              filters: ['custrecord_lmry_br_related_transaction', 'anyof', recordId]
            });

            var resultTransFields = searchTransFields.run().getRange(0, 1);
            if (resultTransFields != null && resultTransFields.length > 0) {
              var row = resultTransFields[0].columns;
              var internalID = resultTransFields[0].getValue(row[0]);

              record.submitFields({
                type: 'customrecord_lmry_br_transaction_fields',
                id: internalID,
                values: {
                  custrecord_lmry_br_trib_fed_nac: sumFedNac,
                  custrecord_lmry_br_trib_fed_imp: sumFedImp,
                  custrecord_lmry_br_trib_est: sumEst,
                  custrecord_lmry_br_trib_mun: sumMun
                },
                options: {
                  ignoreMandatoryFields: true,
                  enableSourcing: true,
                  disableTriggers: true
                }
              });

            } else {
              //Si no existe record Transaction Fields, lo crea
              var new_setrecord = record.create({ type: 'customrecord_lmry_br_transaction_fields', isDynamic: true });

              new_setrecord.setValue('custrecord_lmry_br_related_transaction', recordId);
              new_setrecord.setValue('custrecord_lmry_br_trib_fed_nac', sumFedNac);
              new_setrecord.setValue('custrecord_lmry_br_trib_fed_imp', sumFedImp);
              new_setrecord.setValue('custrecord_lmry_br_trib_est', sumEst);
              new_setrecord.setValue('custrecord_lmry_br_trib_mun', sumMun);

              new_setrecord.save({ ignoreMandatoryFields: true, disableTriggers: true, enableSourcing: true });
            }
          }//Fin band
        }

      } catch (err) {
        library.sendemail(' [ calcularIBPT ] ' + err, LMRY_script);
      }
    }

    function calcularExchangeRate(recordObj) {
      try {
        //Feature subsidiaria
        var featureSubs = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
        var subsidiary = '';
        var exchange_rate = 1;

        if (featureSubs) {
          subsidiary = recordObj.getValue({ fieldId: 'subsidiary' });
        } else {
          subsidiary = recordObj.getValue({ fieldId: 'custbody_lmry_subsidiary_country' });
        }

        var filtros = new Array();
        filtros[0] = search.createFilter({ name: 'isinactive', operator: 'is', values: ['F'] });

        if (featureSubs) {
          filtros[1] = search.createFilter({ name: 'custrecord_lmry_setuptax_subsidiary', operator: 'is', values: [subsidiary] });
        }

        var searchSetupSubsidiary = search.create({ type: "customrecord_lmry_setup_tax_subsidiary", filters: filtros, columns: ['custrecord_lmry_setuptax_currency'] });

        var resultSearchSub = searchSetupSubsidiary.run().getRange(0, 1000);

        if (resultSearchSub.length != null && resultSearchSub.length != '' && resultSearchSub.length > 0) {
          currencySetup = resultSearchSub[0].getValue({ name: 'custrecord_lmry_setuptax_currency' });
          exchange_rate = getExchangeRate(recordObj, currencySetup);
        }

        return exchange_rate;

      } catch (err) {
        library.sendemail(' [ calcularExchangeRate ] ' + err, LMRY_script);
      }
    }

    /********************************************************
     * Funcion que valida si el flujo debe correr en el pais
     * Parámetros :
     *      country : 3 primeras letras del pais
     *      createWHT : check "LatamReady - Applied WHT Code"
     ********************************************************/
    function validarPais(country) {
      try {
        if (country.toUpperCase() == "ARG" || country.toUpperCase() == "BOL" || country.toUpperCase() == "BRA" || country.toUpperCase() == "CHI" || country.toUpperCase() == "COL" || country.toUpperCase() == "COS" || country.toUpperCase() == "ECU" ||
          country.toUpperCase() == "EL " || country.toUpperCase() == "GUA" || country.toUpperCase() == "MEX" || country.toUpperCase() == "PAN" || country.toUpperCase() == "PAR" || country.toUpperCase() == "PER" || country.toUpperCase() == "URU") {
          return true;
        }
      } catch (err) {
        library.sendemail(' [ validarPais ] ' + err, LMRY_script);
      }
      return false;
    }

    /******************************************************************
     * Funcion que elimina los registros asociados a la transaccion del
     * récord "LatamReady - Tax Results" y los journals
     * Parámetros :
     *      recordId : ID de la transacción
     *****************************************************************/
    function deleteAll(recordObj) {
      try {
        /*****************************************************************
         * Busqueda en el record: LatamReady - TAX Results
         *****************************************************************/
        var recordId = recordObj.id;
        deleteTaxResults(recordObj);
        deleteTaxLines(recordObj);

        /***************************
         * Busqueda de los Journal
         ***************************/
        var filtros = new Array();
        filtros[0] = search.createFilter({
          name: 'mainline',
          operator: search.Operator.IS,
          values: ['T']
        });
        filtros[1] = search.createFilter({
          name: 'formulatext',
          formula: '{custbody_lmry_reference_transaction_id}',
          operator: search.Operator.IS,
          values: [recordId]
        });
        var searchJournal = search.create({
          type: 'journalentry',
          filters: filtros,
          columns: ['internalid']
        });
        var resultSJ = searchJournal.run().getRange({
          start: 0,
          end: 1000
        });
        var aux = 0;
        if (resultSJ != null && resultSJ.length > 0) {
          for (var i = 0; i < resultSJ.length; i++) {
            var id = resultSJ[i].getValue({
              name: 'internalid'
            });
            if (id != aux) {
              aux = id;
              var eliminar_je = record.delete({
                type: 'journalentry',
                id: id
              });
            }
          }
        }
      } catch (err) {
        library.sendemail(' [ deleteAll ] ' + err, LMRY_script);
      }
    }

    function deleteTaxResults(recordObj) {
      if (recordObj.id) {
        try {
          var filters = [
            ['custrecord_lmry_br_transaction', 'is', recordObj.id]
          ]

          var country = recordObj.getValue('custbody_lmry_subsidiary_country');
          var type = recordObj.getValue('baserecordtype');

          //BR
          if (Number(country) == 30 && type == 'vendorbill') {
            filters.push('AND', ['custrecord_lmry_created_from_script', 'is', '1']);
          }

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
        } catch (err) {
          library.sendemail(' [ deleteTaxResults ] ' + err, LMRY_script);
        }
      }
    }

    /*************************************************************************
     * Funcion que redondea o trunca los montos dependiendo de la
     * configuración en el récord "LatamReady - Setup Tax Subsidiary"
     * Parámetros :
     *      ret : monto a Redondear / Truncar
     *      rounding : 1: Redondear, 2: Truncar, Vacío: Mantener dos decimales
     *************************************************************************/
    function typeRounding(ret, rounding) {
      var retAux = parseFloat(Math.round(parseFloat(ret) * 100) / 100);
      var decimal;
      switch (rounding) {
        case '1': // Redondear
          decimal = parseFloat(ret) - parseInt(ret);
          if (decimal < 0.5) {
            retAux = parseInt(ret);
          } else {
            retAux = parseInt(ret) + 1;
          }
          break;
        case '2': // Truncar
          retAux = parseInt(ret);
          break;
      }
      retAux = parseFloat(Math.round(parseFloat(retAux) * 100) / 100);
      return retAux;
    }

    /***********************************************************************************
     * Funcion que selecciona la segmentación de los Journal y líneas en el GL Impact
     * dependiendo de la configuración en el récord "LatamReady - Setup Tax Subsidiary"
     * Parámetros :
     *      pref : segmentacion obligatoria en Preferencias Generales
     *      valor1 / valor2 : Segmentacion de la transaccion o CC/NT segun configuracion
     *      valorSetup : segmentación del Setup Tax Subsidiary
     *      valorDefecto : segmentación de la transacción
     ***********************************************************************************/
    function elegirSegmentacion(pref, valor1, valor2, valorSetup, valorDefecto) {
      try {
        if (valor1 != null && valor1 != '') {
          return valor1;
        } else {
          if (pref == true || pref == 'T') {
            if (valor2 == null || valor2 == '') {
              return valorSetup;
            } else {
              return valor2;
            }
          } else {
            if (valorDefecto != '' && valorDefecto != null) {
              return valorDefecto;
            }
          }
        }
        return '';
      } catch (err) {
        library.sendemail(' [ elegirSegmentacion ] ' + err, LMRY_script);
      }
    }

    /***********************************************************************************
     * Funcion que realiza la suma de Porcentajes para calcular el monto base
     * (Pais: Brasil)
     * Parámetros :
     *      searchResultCC_NT : Busqueda de la CC o NT
     *      caso : 1: Caso Totales, 2I: Caso Items
     *      id_appliesto, id_taxrate, id_taxrateSuma : Id's de los campos de la CC o NT
     *      id_line, id_catalogItem : id de la línea / catalogo del item
     ***********************************************************************************/
    function sumaPorcentajes(searchResultCC_NT, caso, id_appliesto, id_taxrate, id_taxrateSuma, id_line, id_catalogItem, subtype) {

      try {
        var sumaPorc = parseFloat(0);
        for (var i = 0; i < searchResultCC_NT.length; i++) {
          var applies_toBR = searchResultCC_NT[i].getValue({
            name: id_appliesto
          });
          var taxrateBR = searchResultCC_NT[i].getValue({
            name: id_taxrate
          });
          var taxrateSuma = searchResultCC_NT[i].getValue({
            name: id_taxrateSuma
          });

          var isTaxByLocation = searchResultCC_NT[i].getValue({
            join: subtype,
            name: "custrecord_lmry_tax_by_location"
          });

          if ((isTaxByLocation == true || isTaxByLocation == 'T') && (applyWHT == true || applyWHT == 'T')) {
            continue;
          }

          if (taxrateSuma != '' && taxrateSuma != null) {
            taxrateBR = parseFloat(taxrateSuma) / 100;
          }


          switch (caso) {
            case '1':
              if (applies_toBR == 1) {
                sumaPorc = parseFloat(sumaPorc + parseFloat(taxrateBR));
              }
              break;
            case '2I':
              //case '2E':
              var catalogItemBR = searchResultCC_NT[i].getValue({
                name: id_line
              });
              if (catalogItemBR != '' && catalogItemBR != null && catalogItemBR == id_catalogItem) {
                sumaPorc = parseFloat(sumaPorc + parseFloat(taxrateBR));
              }
              break;
          }
        }
        return parseFloat(sumaPorc);
      } catch (err) {
        library.sendemail(' [ sumaPorcentajes ] ' + err, LMRY_script);
      }
    }

    /***************************************************************************
     * Funcion que realiza la sumatoria de los Impuestos No Excluyentes para la
     * formula del Monto Base de los Impuestos Excluyentes (Pais: Brasil)
     * Parámetros :
     *      retencionBR : impuesto calculado
     *      n : línea del item
     *      blnBR : False: Impuesto Excluyente , True: Impuesto no Excluyente
     **************************************************************************/
    function baseCalculoBR(retencionBR, n, blnBR) {

      if (arreglo_IndiceBaseBR.length != 0) {
        for (var k = 0; k < arreglo_IndiceBaseBR.length; k++) {
          if (arreglo_IndiceBaseBR[k] == n) {
            if (blnBR == true) { // Inserta la sumatoria de los No Excluyentes
              arreglo_SumaBaseBR[k] = parseFloat(arreglo_SumaBaseBR[k]) + parseFloat(retencionBR);
              return 0;
            } else { // Obtiene la suma de los No Excluyentes almacenada
              return arreglo_SumaBaseBR[k];
            }
          }
        }
      }
      arreglo_IndiceBaseBR.push(n);
      arreglo_SumaBaseBR.push(parseFloat(retencionBR));
      return 0;
    }

    /*************************************************************
     * Funcion que concatena los Impuestos Exentos para un cliente
     * (Pais: Brasil)
     * Parámetros :
     *      entityID : ID del Cliente
     *************************************************************/
    function exemptTaxBR(entityID) {
      var exempts = [];
      var exemptTax = search.lookupFields({
        type: 'customer',
        id: entityID,
        columns: ['custentity_lmry_br_exempt_tax']
      }).custentity_lmry_br_exempt_tax;

      if (exemptTax) {
        for (var i = 0; i < exemptTax.length; i++) {
          exempts.push(exemptTax[i].value);
        }
      }
      return (exempts.length) ? exempts : "";
    }

    /*******************************************************
     * Funcion que cambia el '&lt;g' o '&gt;g' por '>' 0 '<'
     * (FE - Brasil)
     * Parámetros :
     *      xml : cadena a la que se le realizara el cambio
     ******************************************************/
    function replaceXML(xml) {
      xml = xml.replace(/</g, '<');
      xml = xml.replace(/>/g, '>');
      xml = xml.replace(/&lt;/g, '<');
      xml = xml.replace(/&gt;/g, '>');
      return xml;
    }

    /********************************************************
     * Concatena los libros contables en caso tenga Multibook
     ********************************************************/
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

    function cleanLinesforCopy(RCD_TRANS, LICENSES) {
      try {
        var numLineas = RCD_TRANS.getLineCount({
          sublistId: 'item'
        });
        log.error('[numLineas]', numLineas);
        var featureMultiPrice = runtime.isFeatureInEffect({ feature: 'multprice' });

        RCD_TRANS.setValue({ fieldId: 'custbody_lmry_informacion_adicional', value: '' });

        var featureCopy = false;
        if (LICENSES) {
          featureCopy = library.getAuthorization(320, LICENSES);
        }

        for (var i = 0; i < numLineas; i++) {

          var isItemTax = RCD_TRANS.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_ar_item_tributo', line: i });
          var typeDiscount = RCD_TRANS.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_col_sales_type_discount', line: i });

          if ((!isItemTax || isItemTax == 'F') && !typeDiscount) {
            RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_taxc_rsp', i, '');

            if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_freight_val', line: i })) {
              RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_freight_val', i, '');
            }

            if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_insurance_val', line: i })) {
              RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_insurance_val', i, '');
            }

            if (RCD_TRANS.getSublistField({ sublistId: 'item', fieldId: 'custcol_lmry_br_expens_val', line: i })) {
              RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_expens_val', i, '');
            }

            if (featureCopy == true) {
              var base_amount = RCD_TRANS.getSublistValue('item', 'custcol_lmry_br_base_amount', i); //base_amount es el nuevo net
              if (base_amount) {
                var quantityItem = RCD_TRANS.getSublistValue('item', 'quantity', i);
                quantityItem = parseFloat(quantityItem);
                var rateItem = parseFloat(base_amount) / quantityItem;

                if (featureMultiPrice == true || featureMultiPrice == 'T') {
                  RCD_TRANS.setSublistValue('item', 'price', i, -1);
                }
                RCD_TRANS.setSublistValue('item', 'rate', i, round2(rateItem));
                RCD_TRANS.setSublistValue('item', 'amount', i, round2(base_amount));
                RCD_TRANS.setSublistValue('item', 'taxrate1', i, '0%');
                RCD_TRANS.setSublistValue('item', 'taxamount', i, 0);
                RCD_TRANS.setSublistValue('item', 'grossamt', i, round2(base_amount));
                RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_base_amount', i, '');
                RCD_TRANS.setSublistValue('item', 'custcol_lmry_br_total_impuestos', i, '');

              }
            }
          }
        }

        deleteTaxDetailsLines(RCD_TRANS);
        deleteTaxLines(RCD_TRANS);

      } catch (err) {
        library.sendemail(' [ cleanLinesforCopy ] ' + err, LMRY_script);
      }
    }

    function deleteTaxDetailsLines(recordObj) {

      try {

        var getTaxLineCount = recordObj.getLineCount({ sublistId: 'taxdetails' });
        if(getTaxLineCount > 0 && getTaxLineCount) {
          for(var i = getTaxLineCount-1; i >= 0; i--) {
            recordObj.removeLine({ sublistId: 'taxdetails', line: i });
          }
        }

      } catch (e) {
        log.error('[ ST Tax Transaction - deleteTaxDetailsLines ]', e);
      }

    }

    function deleteTaxLines(recordObj) {

      while (true) {
        var idxRemove = -1;
        var currentNumberLine = recordObj.getLineCount({
          sublistId: 'item'
        });

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

    function hasBRCatalog(recordObj) {
      var numLines = recordObj.getLineCount({ sublistId: 'item' });
      var found = false;
      for (var i = 0; i < numLines; i++) {
        var catalog = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_br_service_catalog', line: i });
        if (catalog) {
          found = true;
          break;
        }
      }
      return found;
    }

    function round2(num) {
      if (num >= 0) {
        return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-3) / 1e2);
      } else {
        return parseFloat(Math.round(parseFloat(num) * 1e2 - 1e-3) / 1e2);
      }
    }

    function round4(num) {
      if (num >= 0) {
        return parseFloat(Math.round(parseFloat(num) * 1e4 + 1e-3) / 1e4);
      } else {
        return parseFloat(Math.round(parseFloat(num) * 1e4 - 1e-3) / 1e4);
      }
    }

    function getExchangeRate(recordObj, currencySetup) {
      var exchangerate = 1;
      var featureMB = runtime.isFeatureInEffect({
        feature: "MULTIBOOK"
      });

      var featureSubs = runtime.isFeatureInEffect({
        feature: "SUBSIDIARIES"
      });

      var tran_exchangerate = recordObj.getValue({ fieldId: 'exchangerate' })

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


    function set_EI_TelecommunicationsTaxes(recordObj) {
      var documentType = recordObj.getValue("custbody_lmry_document_type");
      if (Number(documentType) == 847) {
        try {
          require(["/SuiteBundles/Bundle 245636/EI_Library/LMRY_EI_OTH_SERV_LBRY_V2.0"], function (library_ei) {
            library_ei.encryptionKey(recordObj);
          });
        } catch (err) {
          log.error('[After Submit - EI_Library]', err)
        }
      }
    }

    function getDiscountAmounts(recordObj) {
      var discountAmounts = {};
      var numItems = recordObj.getLineCount({ sublistId: "item" });
      var discountAmount = 0.00, currentItemPosition = -1;
      for (var i = 0; i < numItems; i++) {
        var typeDiscount = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_col_sales_type_discount", line: i });
        if (typeDiscount) {
          if (Number(typeDiscount) == 1) {
            var amount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: i }) || 0.00;
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


    function validateMemo(recordObj) {
      var MEMOS = ["Reference VOID", "(LatamTax -  WHT)", "Latam - Interest and Penalty", "Voided Latam - WHT"];
      var memo = recordObj.getValue("memo");
      for (var i = 0; i < MEMOS.length; i++) {
        if (memo.substring(0, MEMOS[i].length) == MEMOS[i]) {
          return false;
        }
      }

      return true;
    }

    function getmvaRecords(recordObj) {
      var mvaRecords = {};
      var filters = [
        ["isinactive", "is", "F"]
      ];

      var FEAT_SUBS = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

      if (FEAT_SUBS) {
        var subsidiary = recordObj.getValue("subsidiary");
        filters.push("AND", ["custrecord_lmry_br_mva_subsidiary", "anyof", subsidiary]);
      }

      var mvaSearch = search.create({
        type: "customrecord_lmry_br_mva",
        filters: filters,
        columns: ["internalid", "custrecord_lmry_br_mva_rate",
          "custrecord_lmry_br_mva_ncm", "custrecord_lmry_br_mva_subtype", "custrecord_lmry_br_mva_taxrate",
          "custrecord_lmry_br_mva_subtype_substi", "custrecord_lmry_br_mva_taxrate_substi"
        ]
      });

      var results = mvaSearch.run().getRange(0, 1000);
      if (results && results.length) {
        for (var i = 0; i < results.length; i++) {
          var internalId = results[i].getValue("internalid");
          var mvaRate = results[i].getValue("custrecord_lmry_br_mva_rate");
          mvaRate = parseFloat(mvaRate) || 0.00;
          var mcnCode = results[i].getValue("custrecord_lmry_br_mva_ncm");
          var taxSubtype = results[i].getValue("custrecord_lmry_br_mva_subtype");
          var taxRate = results[i].getValue("custrecord_lmry_br_mva_taxrate") || 0.00;
          taxRate = parseFloat(taxRate);
          var substiTaxSubtype = results[i].getValue("custrecord_lmry_br_mva_subtype_substi");
          var substiTaxRate = results[i].getValue("custrecord_lmry_br_mva_taxrate_substi") || 0.00;
          substiTaxRate = parseFloat(substiTaxRate);

          mvaRecords[mcnCode] = mvaRecords[mcnCode] || [];
          mvaRecords[mcnCode].push({
            mvaId: internalId,
            mvaRate: mvaRate,
            mcnCode: mcnCode,
            taxSubtype: taxSubtype,
            taxRate: taxRate,
            substiTaxSubtype: substiTaxSubtype,
            substiTaxRate: substiTaxRate
          });
        }
      }

      return mvaRecords;
    }

    function getMVAByValues(mvaRecords, mcnCode, subtype, taxRate, substiSubtype, substiTaxRate) {
      log.error("[mcnCode, subtype, taxRate, substiSubtype, substiTaxRate]", [mcnCode, subtype, taxRate, substiSubtype, substiTaxRate].join("-"));
      var mvaList = [];
      if (mvaRecords[mcnCode]) {
        var records = mvaRecords[mcnCode];
        for (var i = 0; i < records.length; i++) {
          var MVA = records[i];
          var found = true;
          if (subtype && (Number(MVA["taxSubtype"]) != Number(subtype))) {
            found = false;
          }

          if (taxRate && (round4(MVA["taxRate"]) != round4(taxRate))) {
            found = false;
          }

          if (substiSubtype && (Number(MVA["substiTaxSubtype"]) != Number(substiSubtype))) {
            found = false;
          }

          if (substiTaxRate && (round4(MVA["substiTaxRate"]) != round4(substiTaxRate))) {
            found = false;
          }

          if (found) {
            mvaList.push(MVA);
          }
        }
      }
      log.error("mvaList", JSON.stringify(mvaList));

      return mvaList;
    }

    function calculateSubstitutionTaxes(recordObj, taxesToST, stTaxes, taxesNotIncluded, taxResults, exchangeRate) {
      var numItems = recordObj.getLineCount({ sublistId: "item" });
      for (var i = 0; i < numItems; i++) {
        var item = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
        var lineUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: i });
        var grossAmt = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'grossamt', line: i });
        grossAmt = parseFloat(grossAmt);
        if (taxesToST[i]) {

          var totalTaxesNotIncluded = 0.00;
          if (taxesNotIncluded[i]) {
            for (var tx in taxesNotIncluded[i]) {
              totalTaxesNotIncluded = totalTaxesNotIncluded + (taxesNotIncluded[i][tx]["amount"] || 0.00)
            }
          }

          for (var mvaId in taxesToST[i]) {
            for (var t = 0; t < taxesToST[i][mvaId].length; t++) {
              var tax = taxesToST[i][mvaId][t];
              var taxRate = tax["taxRate"];
              taxRate = parseFloat(taxRate);
              var mvaRate = tax["mvaRate"];
              var baseSt = (grossAmt + totalTaxesNotIncluded) * (1 + mvaRate);
              baseSt = round2(baseSt);
              if (baseSt) {
                if (stTaxes[i] && stTaxes[i][mvaId]) {
                  for (var s = 0; s < stTaxes[i][mvaId].length; s++) {
                    var stTax = stTaxes[i][mvaId][s];
                    var stTaxRate = stTax["taxRate"];

                    var stTaxAmount = baseSt * stTaxRate - grossAmt * taxRate;

                    var localCurrBaseAmt = baseSt;
                    var localCurrAmt = stTaxAmount;
                    var localCurrGrossAmt = grossAmt;

                    if (exchangeRate != 1) {
                      localCurrBaseAmt = round2(baseSt) * exchangeRate;
                      localCurrAmt = round2(stTaxAmount) * exchangeRate;
                      localCurrGrossAmt = round2(grossAmt) * exchangeRate;
                    }

                    if (stTaxAmount) {
                      taxResults.push({
                        subtype: stTax["subType"],
                        subtypeId: stTax["subTypeId"],
                        lineuniquekey: lineUniqueKey,
                        baseAmount: baseSt,
                        amount: round4(stTaxAmount),
                        taxRecordId: stTax["taxRecordId"],
                        taxRate: stTaxRate,
                        case: '2I',
                        item: item,
                        position: i,
                        receita: stTax["receita"],
                        taxSituation: stTax["taxSituation"],
                        natureRevenue: stTax["natureRevenue"],
                        localCurrBaseAmt: localCurrBaseAmt,
                        localCurrAmt: localCurrAmt,
                        isSubstitutionTax: true,
                        isTaxNotIncluded: true,
                        taxItem: stTax["taxItem"],
                        taxCode: stTax["taxCode"]
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    function addTaxItems(recordObj, taxResults, departmentSetup, classSetup, locationSetup) {
      var FEAT_DEPT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
      var FEAT_LOC = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
      var FEAT_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
      var DEPTMANDATORY = runtime.getCurrentUser().getPreference({ name: "DEPTMANDATORY" });
      var LOCMANDATORY = runtime.getCurrentUser().getPreference({ name: "LOCMANDATORY" });
      var CLASSMANDATORY = runtime.getCurrentUser().getPreference({ name: "CLASSMANDATORY" });

      var department = recordObj.getValue("department") || "";
      var class_ = recordObj.getValue("class") || "";
      var location = recordObj.getValue("location") || "";

      var taxItems = {}
      for (var i = 0; i < taxResults.length; i++) {
        var taxResult = taxResults[i];
        var subTypeId = taxResult["subtypeId"];
        var subType = taxResult["subtype"];
        var taxItem = taxResult["taxItem"];
        var taxAmount = taxResult["amount"];
        var taxCode = taxResult["taxCode"];
        var isTaxNotIncluded = taxResult["isTaxNotIncluded"]

        if (isTaxNotIncluded && taxItem) {
          var key = subTypeId + "-" + taxItem;
          if (!taxItems[key]) {
            taxItems[key] = {
              subTypeId: subTypeId,
              subType: subType,
              item: taxItem,
              taxCode: taxCode,
              amount: 0.00
            }
          }

          taxItems[key]["amount"] = taxItems[key]["amount"] + parseFloat(taxAmount);

        }
      }


      log.error("taxItems", JSON.stringify(taxItems));

      for (var k in taxItems) {
        var lineNum = recordObj.getLineCount('item');
        var tax = taxItems[k];
        var subType = tax["subType"];
        var item = tax["item"];
        var amount = tax["amount"];
        amount = round2(amount);
        var taxCode = tax["taxCode"] || "";

        recordObj.insertLine({ sublistId: 'item', line: lineNum });
        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'item', line: lineNum, value: item });
        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineNum, value: 1 });
        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineNum, value: amount });
        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'taxcode', line: lineNum, value: taxCode });
        var description = subType + ' (LatamTax) ';
        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'description', line: lineNum, value: description });
        recordObj.setSublistValue({ sublistId: 'item', fieldId: 'custcol_lmry_ar_item_tributo', line: lineNum, value: true });
        if (FEAT_DEPT == "T" || FEAT_DEPT == true) {
          recordObj.setSublistValue({ sublistId: 'item', fieldId: 'department', line: lineNum, value: department });
          if ((DEPTMANDATORY == "T" || DEPTMANDATORY == true) && !department) {
            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'department', line: lineNum, value: departmentSetup });
          }
        }

        if (FEAT_CLASS == "T" || FEAT_CLASS == true) {
          recordObj.setSublistValue({ sublistId: 'item', fieldId: 'class', line: lineNum, value: class_ });
          if ((CLASSMANDATORY == "T" || CLASSMANDATORY == true) && !class_) {
            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'class', line: lineNum, value: classSetup });
          }
        }

        if (FEAT_LOC == "T" || FEAT_LOC == true) {
          recordObj.setSublistValue({ sublistId: 'item', fieldId: 'location', line: lineNum, value: location });
          if ((LOCMANDATORY == "T" || LOCMANDATORY == true) && !location) {
            recordObj.setSublistValue({ sublistId: 'item', fieldId: 'location', line: lineNum, value: locationSetup });
          }
        }
      }
    }


    return {
      beforeSubmitTransaction: beforeSubmitTransaction,
      afterSubmitTransaction: afterSubmitTransaction,
      cleanLinesforCopy: cleanLinesforCopy,
      deleteTaxResults: deleteTaxResults,
      deleteTaxLines: deleteTaxLines
    };

  });
