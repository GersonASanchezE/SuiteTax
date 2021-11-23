/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_CL_ST_Transaction_Sales_LBRY_V2.0.js		    ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Abr 20 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/log', 'N/format', 'N/record', 'N/search', 'N/runtime', './LMRY_libSendingEmailsLBRY_V2.0'],
  function (log, format, record, search, runtime, library) {
    var LMRY_script = 'LatamReady - TAX Transaction LBRY CL';
    var taxCalculated = false;
    var FEATURE_SUBSIDIARY = false;
    var FEATURE_MULTIBOOK = false;
    /*********************************************************************************************************
     * Funcion que realiza el calculo de los impuestos.
     * Para Chile: Llamada desde el User Event del Invoice, Credit Memo.
     ********************************************************************************************************/
    function afterSubmitTransaction(scriptContext) {
      try {
        
        var recordObj = scriptContext.newRecord;
        var type = scriptContext.type;
        
        if (type == 'create' || type == 'edit' || type == 'copy') {

          var recordId = '';
          var transactionType = '';
          
          recordId = scriptContext.newRecord.id;
          transactionType = scriptContext.newRecord.type;
          
          var override = recordObj.getValue({fieldId: 'taxdetailsoverride'});

          if(override == true || override == 'T'){
  
            FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});
            FEATURE_MULTIBOOK = runtime.isFeatureInEffect({feature: "MULTIBOOK"});
            
            var subsidiary;
            if (FEATURE_SUBSIDIARY) {
              subsidiary = recordObj.getValue({fieldId: 'subsidiary'});
            } else {
              subsidiary = recordObj.getValue({fieldId: 'custbody_lmry_subsidiary_country'});
            }
            
            var transactionDate = recordObj.getText({fieldId: 'trandate'});
            var idCountry = recordObj.getValue({fieldId: 'custbody_lmry_subsidiary_country'});
            var transactionEntity = recordObj.getValue({fieldId: 'entity'});
            var transactionDocumentType = recordObj.getValue({fieldId: 'custbody_lmry_document_type'});
  
            var filtroTransactionType;
            switch (transactionType) {
              case 'invoice':
                filtroTransactionType = 1;
                break;
              case 'creditmemo':
                filtroTransactionType = 8;
                break;
              default:
                return recordObj;
            }
  
            var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
            var exchangeRate = getExchangeRate(recordObj, subsidiary, setupSubsidiary);
            
            var setupTaxSubsiRounding = setupSubsidiary["rounding"]; 
            
            var itemLineCount = recordObj.getLineCount({sublistId: 'item'});
            var CC_SearchResult = getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, transactionEntity, transactionDocumentType);
            
            var taxResults = [];
            
            if (itemLineCount != "" && itemLineCount != 0) {

              var lastDetailLine = 0;
              for (var i = 0; i < itemLineCount; i++) {

                var item = recordObj.getSublistText({ sublistId: 'item', fieldId: 'item', line: i });
                var itemID = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var itemUniqueKey = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
                var itemInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'item', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: i });
                var itemDetailReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: i });

                if( itemInvoiceIdentifier != null && itemInvoiceIdentifier != "" ) {
                  var II_JSON = getInvoicingIdentifierJSON(itemInvoiceIdentifier);
                  log.debug('[ II_JSON ]', II_JSON);
                } else {
                  break;
                }

                var itemNetAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: i }) || 0.0;

                if (CC_SearchResult != null && CC_SearchResult.length > 0) {
                  for (var j = 0; j < CC_SearchResult.length; j++) {
                    var CC_internalID = CC_SearchResult[j].getValue({ name: "internalid" });
                    var CC_generatedTransaction = CC_SearchResult[j].getText({ name: "custrecord_lmry_ccl_gen_transaction" });
                    var CC_generatedTransactionID = CC_SearchResult[j].getValue({ name: "custrecord_lmry_ccl_gen_transaction" });
                    var CC_taxType = CC_SearchResult[j].getText({ name: "custrecord_lmry_ccl_taxtype" });
                    var CC_taxTypeID = CC_SearchResult[j].getValue({ name: "custrecord_lmry_ccl_taxtype" });
                    var CC_STE_taxType = CC_SearchResult[j].getText({ name: "custrecord_lmry_cc_ste_tax_type" });
                    var CC_STE_taxTypeID = CC_SearchResult[j].getValue({ name: "custrecord_lmry_cc_ste_tax_type" });
                    var CC_STE_taxCode = CC_SearchResult[j].getText({ name: "custrecord_lmry_cc_ste_tax_code" });
                    var CC_STE_taxCodeID = CC_SearchResult[j].getValue({ name: "custrecord_lmry_cc_ste_tax_code" });
                    var CC_taxRate = CC_SearchResult[j].getValue({ name: "custrecord_lmry_ar_ccl_taxrate" });
                    var CC_isExempt = CC_SearchResult[j].getValue({ name: "custrecord_lmry_ar_ccl_isexempt" });
                    var CC_invIdent = CC_SearchResult[j].getText({ name: "custrecord_lmry_cc_invoice_identifier" });
                    var CC_invIdentID = CC_SearchResult[j].getValue({ name: "custrecord_lmry_cc_invoice_identifier" });
                    var CC_Department = CC_SearchResult[j].getText({ name: "custrecord_lmry_ar_ccl_department" });
                    var CC_DepartmentID = CC_SearchResult[j].getValue({ name: "custrecord_lmry_ar_ccl_department" });
                    var CC_Class = CC_SearchResult[j].getText({ name: "custrecord_lmry_ar_ccl_class" });
                    var CC_ClassID = CC_SearchResult[j].getValue({ name: "custrecord_lmry_ar_ccl_class" });
                    var CC_Location = CC_SearchResult[j].getText({ name: "custrecord_lmry_ar_ccl_location" });
                    var CC_LocationID = CC_SearchResult[j].getValue({ name: "custrecord_lmry_ar_ccl_location" });
  
                    if ((II_JSON.invoicing == CC_invIdent) && (II_JSON.taxtype == CC_STE_taxType) && (II_JSON.taxcode == CC_STE_taxCode)) {
                      var taxAmountNoRounded = parseFloat(itemNetAmount) * parseFloat(CC_taxRate);
                      var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);

                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: itemDetailReference });
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: CC_STE_taxTypeID });
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: CC_STE_taxCodeID });
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(itemNetAmount) });
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(CC_taxRate) * 100 });
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: taxAmount });


                      taxResults.push({
                        taxtype: {
                            text: CC_taxType,
                            value: CC_taxTypeID
                        },
                        ste_taxtype: {
                            text: CC_STE_taxType,
                            value: CC_STE_taxTypeID
                        },
                        ste_taxcode: {
                            text: CC_STE_taxCode,
                            value: CC_STE_taxCodeID
                        },
                        lineuniquekey: itemUniqueKey,
                        baseamount: parseFloat(itemNetAmount),
                        taxamount: taxAmount,
                        taxrate: CC_taxRate,
                        contributoryClass: CC_internalID,
                        nationalTax: "",
                        debitaccount: {},
                        creditaccount: {},
                        generatedtransaction: {
                            text: CC_generatedTransaction,
                            value: CC_generatedTransactionID
                        },
                        department: {
                            text: CC_Department,
                            value: CC_DepartmentID
                        },
                        class: {
                            text: CC_Class,
                                value: CC_ClassID
                        },
                        location: {
                            text: CC_Location,
                            value: CC_LocationID
                        },
                        item: {
                            text: item,
                            value: itemID
                        },
                        expenseacc: {},
                        position: i,
                        description: "",
                        lc_baseamount: parseFloat(itemNetAmount * exchangeRate),
                        lc_taxamount: parseFloat(taxAmountNoRounded * exchangeRate),
                        lc_grossamount: parseFloat(parseFloat(itemNetAmount + taxAmountNoRounded) * exchangeRate)
                      });
                      lastDetailLine += 1;
                      break;
                    }
                  } // FIN FOR CONTRIBUTORY CLASS
                } // FIN IF CONTRIBUTORY CLASS
                else { 
                  var NT_SearchResult = getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, transactionDocumentType);
                  if (NT_SearchResult != null && NT_SearchResult.length > 0) {
                    for (var j = 0; j < NT_SearchResult.length; j++) {
                      var NT_internalID = NT_SearchResult[j].getValue({ name: "internalid" });
                      var NT_generatedTransaction = NT_SearchResult[j].getText({ name: "custrecord_lmry_ntax_gen_transaction" });
                      var NT_generatedTransactionID = NT_SearchResult[j].getValue({ name: "custrecord_lmry_ntax_gen_transaction" });
                      var NT_taxType = NT_SearchResult[j].getText({ name: "custrecord_lmry_ntax_taxtype" });
                      var NT_taxTypeID = NT_SearchResult[j].getValue({ name: "custrecord_lmry_ntax_taxtype" });
                      var NT_STE_taxType = NT_SearchResult[j].getText({ name: "custrecord_lmry_nt_ste_tax_type" });
                      var NT_STE_taxTypeID = NT_SearchResult[j].getValue({ name: "custrecord_lmry_nt_ste_tax_type" });
                      var NT_STE_taxCode = NT_SearchResult[j].getText({ name: "custrecord_lmry_nt_ste_tax_code" });
                      var NT_STE_taxCodeID = NT_SearchResult[j].getValue({ name: "custrecord_lmry_nt_ste_tax_code" });
                      var NT_taxRate = NT_SearchResult[j].getValue({ name: "custrecord_lmry_ntax_taxrate" });
                      var NT_isExempt = NT_SearchResult[j].getValue({ name: "custrecord_lmry_ntax_isexempt" });
                      var NT_invIdent = NT_SearchResult[j].getText({ name: "custrecord_lmry_nt_invoicing_identifier" });
                      var NT_invIdentID = NT_SearchResult[j].getValue({ name: "custrecord_lmry_nt_invoicing_identifier" });
                      var NT_Department = NT_SearchResult[j].getText({ name: "custrecord_lmry_ntax_department" });
                      var NT_DepartmentID = NT_SearchResult[j].getValue({ name: "custrecord_lmry_ntax_department" });
                      var NT_Class = NT_SearchResult[j].getText({ name: "custrecord_lmry_ntax_class" });
                      var NT_ClassID = NT_SearchResult[j].getValue({ name: "custrecord_lmry_ntax_class" });
                      var NT_Location = NT_SearchResult[j].getText({ name: "custrecord_lmry_ntax_location" });
                      var NT_LocationID = NT_SearchResult[j].getValue({ name: "custrecord_lmry_ntax_location" });

                      if ((II_JSON.invoicing == NT_invIdent) && (II_JSON.taxtype == NT_STE_taxType) && (II_JSON.taxcode == NT_STE_taxCode)) {
                        var taxAmountNoRounded = parseFloat(itemNetAmount) * parseFloat(NT_taxRate);
                        var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);

                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: itemDetailReference });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: NT_STE_taxTypeID });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: NT_STE_taxCodeID });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(itemNetAmount) });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(NT_taxRate) * 100 });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: taxAmount });

                        taxResults.push({
                          taxtype: {
                              text: NT_taxType,
                              value: NT_taxTypeID
                          },
                          ste_taxtype: {
                              text: NT_STE_taxType,
                              value: NT_STE_taxTypeID
                          },
                          ste_taxcode: {
                              text: NT_STE_taxCode,
                              value: NT_STE_taxCodeID
                          },
                          lineuniquekey: itemUniqueKey,
                          baseamount: parseFloat(itemNetAmount),
                          taxamount: taxAmount,
                          taxrate: NT_taxRate,
                          contributoryClass: "",
                          nationalTax: NT_internalID,
                          debitaccount: {},
                          creditaccount: {},
                          generatedtransaction: {
                              text: NT_generatedTransaction,
                              value: NT_generatedTransactionID
                          },
                          department: {
                              text: NT_Department,
                              value: NT_DepartmentID
                          },
                          class: {
                              text: NT_Class,
                              value: NT_ClassID
                          },
                          location: {
                              text: NT_Location,
                              value: NT_LocationID
                          },
                          item: {
                              text: item,
                              value: itemID
                          },
                          expenseacc: {},
                          position: i,
                          description: "",
                          lc_baseamount: parseFloat(itemNetAmount * exchangeRate),
                          lc_taxamount: parseFloat(taxAmountNoRounded * exchangeRate),
                          lc_grossamount: parseFloat(parseFloat(itemNetAmount + taxAmountNoRounded) * exchangeRate)
                        });

                        lastDetailLine += 1;

                        break;
                      }
                    } // FIN FOR NATIONAL TAX
                  } // FIN IF NATIONAL TAX
                } // FIN ELSE
              } // FIN FOR ITEM COUNT
              saveTaxResult(recordId, subsidiary, idCountry, taxResults);
            }
            
          } // Fin if taxdetailsoverride
        } // Fin If create, edit o copy
      } catch (err) {
        log.error("Error AfterSubmit", err);
        library.sendemail(' [ After Submit ] ' + err, LMRY_script);
      }
      return recordObj;
    }

    /**************************************************************************************************
     * Funcion que permite obtener un array json con los datos para las lineas del Tax Details 
     **************************************************************************************************/
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

    /**************************************************************************************************
     * Funcion que permite agregar lineas al Tax Details
     **************************************************************************************************/
    function setTaxDetailLines( tr_details, recordObj, itemLine, taxCode, taxType, uniqueKeyItem, taxDetailsReference, amountItem ) {
      try {
        var taxRate = parseFloat(tr_details[uniqueKeyItem]["taxrate"]);
        var taxAmount = parseFloat(tr_details[uniqueKeyItem]["taxamount"]);

        recordObj.setSublistValue({sublistId: 'taxdetails', fieldId: 'taxdetailsreference', line: itemLine, value: taxDetailsReference});
        recordObj.setSublistValue({sublistId: 'taxdetails', fieldId: 'taxtype', line: itemLine, value: taxType});
        recordObj.setSublistValue({sublistId: 'taxdetails', fieldId: 'taxcode', line: itemLine, value: taxCode});
        recordObj.setSublistValue({sublistId: 'taxdetails', fieldId: 'taxbasis', line: itemLine, value: tr_details[uniqueKeyItem]["baseamount"]});
        recordObj.setSublistValue({sublistId: 'taxdetails', fieldId: 'taxrate', line: itemLine, value: taxRate});
        recordObj.setSublistValue({sublistId: 'taxdetails', fieldId: 'taxamount', line: itemLine, value: taxAmount });
          
      } catch(e) {
        log.error('[ aftersubmit - setTaxDetailLines ]', e);
      }
    }
    
    /**************************************************************************************************
     * Funcion que permite agregar al record de Tax Details
     **************************************************************************************************/
    function saveTaxResult(transaction, subsidiary, country, taxResult){
      try{
        var resultSearchTR = search.create({
          type: 'customrecord_lmry_latamtax_tax_result',
          columns: ['internalid'],
          filters: ["custrecord_lmry_tr_related_transaction", "is", transaction]
        }).run().getRange(0, 10);
        
        if(resultSearchTR != null && resultSearchTR.length > 0){
          var recordId = resultSearchTR[0].getValue("internalid");
          
          record.submitFields({
            type: 'customrecord_lmry_latamtax_tax_result',
            id: recordId,
            values: {
                'custrecord_lmry_tr_subsidiary': subsidiary,
                'custrecord_lmry_tr_country': country,
                'custrecord_lmry_tr_tax_transaction': JSON.stringify(taxResult)
            },
            options: {
              enableSourcing: false,
              ignoreMandatoryFields : true
            }
          });
        }
        else{
          var recordTR = record.create({
            type: 'customrecord_lmry_latamtax_tax_result',
            isDynamic: false
          });
          recordTR.setValue({
            fieldId: 'custrecord_lmry_tr_related_transaction',
            value: transaction
          });
          recordTR.setValue({
            fieldId: 'custrecord_lmry_tr_subsidiary',
            value: subsidiary
          });
          recordTR.setValue({
            fieldId: 'custrecord_lmry_tr_country',
            value: country
          });
          recordTR.setValue({
            fieldId: 'custrecord_lmry_tr_tax_transaction',
            value: JSON.stringify(taxResult)
          });
          recordTR.save({
            enableSourcing: true,
            ignoreMandatoryFields: true,
            disableTriggers: true
          });
        }
      } catch(e){
        log.error('[ aftersubmit - saveTaxResult ]', e);
      }
    }

    function cleanLinesforCopy(RCD_TRANS, LICENSES) {
      try {
        var numLineas = RCD_TRANS.getLineCount({
          sublistId: 'item'
        });

        RCD_TRANS.setValue({fieldId: 'custbody_lmry_informacion_adicional', value: ''});

        for (var i = 0; i < numLineas; i++) {

            var amountItem = RCD_TRANS.getSublistValue({sublistId: 'item', fieldId: 'amount', line: i});            
            RCD_TRANS.setSublistValue('item', 'taxamount', i, 0);
            RCD_TRANS.setSublistValue('item', 'grossamt', i, amountItem);
            
            RCD_TRANS.removeLine({sublistId: 'taxdetails', line: 0});
        }
      } catch (err) {
        library.sendemail(' [ cleanLinesforCopy ] ' + err, LMRY_script);
      }
    }

    function deleteTaxResultRC(transaction){
      try{
        var resSearch = search.create({
          type: 'customrecord_lmry_latamtax_tax_result',
          columns: ['id'],
          filters: ["custrecord_lmry_tr_related_transaction", "is", transaction]
        }).run().getRange({start: 0,end: 10});
        if(resSearch != null && resSearch.length > 0){
          var recordId = resSearch[0].getValue("id");
          record.delete({
            type: 'customrecord_lmry_latamtax_tax_result',
            id: recordId
          });
        }
      }
      catch (e){
        log.error('[ aftersubmit - deleteTaxResultRC ]', e);
        library.sendemail(' [ deleteTaxResultRC ] ' + err, LMRY_script);
      }
    }

    /*******************************************************************************************
    * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
    *******************************************************************************************/
    function getExchangeRate (recordObj, subsidiary, setupSubsidiary){
      try{
        var exchangeRate = 1;

        if (FEATURE_SUBSIDIARY && FEATURE_MULTIBOOK) {
          // OneWorld y Multibook
          var currencySubs = search.lookupFields({
            type: "subsidiary",
            id: subsidiary,
            columns: ["currency"],
          });
          currencySubs = currencySubs.currency[0].value;
          // log.error("currencySubs", currencySubs);
          // log.error("setupSubsidiary['currency']", setupSubsidiary['currency']);

          if (currencySubs != setupSubsidiary['currency'] && setupSubsidiary['currency'] != "" && setupSubsidiary['currency'] != null) {
            var lineasBook = recordObj.getLineCount({
              sublistId: "accountingbookdetail",
            });
            //log.error("lineasBook", lineasBook);

            if (lineasBook != null && lineasBook != "") {
              for (var i = 0; i < lineasBook; i++) {
                var lineaCurrencyMB = recordObj.getSublistValue({
                  sublistId: "accountingbookdetail",
                  fieldId: "currency",
                  line: i
                });
                if (lineaCurrencyMB == setupSubsidiary['currency']) {
                  exchangeRate = recordObj.getSublistValue({
                    sublistId: "accountingbookdetail",
                    fieldId: "exchangerate",
                    line: i
                  });
                  break;
                }
              }
            }
          } else {
            // La moneda de la subsidiaria es igual a la moneda del setup
            exchangeRate = recordObj.getValue({
              fieldId: "exchangerate",
            });
          }
        } else {
          // No es OneWorld o no tiene Multibook
          exchangeRate = recordObj.getValue({
            fieldId: "exchangerate",
          });
        }
        exchangeRate = parseFloat(exchangeRate);
        return exchangeRate;
      }catch(e){
        log.error("[ aftersubmit - getExchangeRate ]", e);
      }
    }

    /***************************************************************************
    * BUSQUEDA DEL RECORD: LATMAREADY - CONTRIBUTORY CLASS
    *    - subsidiary: Subsiaria
    *    - transactionDate: Fecha de creación de la transacción
    *    - filtroTransactionType: Invoice / Credit Memo
    *    - entity: ID de la Entidad
    *    - transactionDocumentType: Tipo de Documento Fiscal
    ***************************************************************************/
  function getContributoryClasses (subsidiary, transactionDate, filtroTransactionType, entity, transactionDocumentType) {
    var filtrosCC = [
      ["isinactive", "is", "F"],
      "AND",
      ["custrecord_lmry_ar_ccl_fechdesd", "onorbefore", transactionDate],
      "AND",
      ["custrecord_lmry_ar_ccl_fechhast", "onorafter", transactionDate],
      "AND",
      ["custrecord_lmry_ccl_transactiontypes", "anyof", filtroTransactionType],
      "AND",
      ["custrecord_lmry_ar_ccl_entity", "anyof", entity],
      "AND",
      ["custrecord_lmry_ccl_taxtype", "anyof", ["4"]], //1:Retencion, 2:Percepcion, 3:Detraccion, 4:Calculo de Impuesto
      "AND",
      ["custrecord_lmry_ccl_gen_transaction", "anyof", "6"], //1:Journal, 2:SuiteGL, 3:LatamTax(Purchase), 4:Add Line, 5: WhtbyTrans, 6: LatamTax (Sales)
    ];

    var documents = ["@NONE@"];
    if (transactionDocumentType) {
      documents.push(transactionDocumentType);
    }
    filtrosCC.push("AND", ["custrecord_lmry_ccl_fiscal_doctype", "anyof", documents]);

    if (FEATURE_SUBSIDIARY) {
      filtrosCC.push("AND", ["custrecord_lmry_ar_ccl_subsidiary", "anyof", subsidiary]);
    }

    var searchCC = search.create({
      type: "customrecord_lmry_ar_contrib_class",
      columns: [
        "custrecord_lmry_ar_ccl_taxrate",
        "internalid",
        "custrecord_lmry_ccl_gen_transaction",
        "custrecord_lmry_ar_ccl_department",
        "custrecord_lmry_ar_ccl_class",
        "custrecord_lmry_ar_ccl_location",
        "custrecord_lmry_ar_ccl_taxitem",
        "custrecord_lmry_ccl_taxtype",
        "custrecord_lmry_cc_invoice_identifier",
        "custrecord_lmry_cc_ste_tax_type",
        "custrecord_lmry_cc_ste_tax_code",
        "custrecord_lmry_ccl_appliesto"
      ],
      filters: filtrosCC,
    });

    var searchResultCC = searchCC.run().getRange({
      start: 0,
      end: 1000
    });
    return searchResultCC;
  }

  /***************************************************************************
    * BUSQUEDA DEL RECORD: LATMAREADY - NATIONAL TAX
    *    - subsidiary: Subsiaria
    *    - transactionDate: Fecha de creación de la transacción
    *    - filtroTransactionType: Invoice / Credit Memo
    *    - transactionDocumentType: Tipo de Documento Fiscal
    ***************************************************************************/
  function getNationalTaxes (subsidiary, transactionDate, filtroTransactionType, transactionDocumentType) {
    var filtrosNT = [
      ["isinactive", "is", "F"],
      "AND",
      ["custrecord_lmry_ntax_datefrom", "onorbefore", transactionDate],
      "AND",
      ["custrecord_lmry_ntax_dateto", "onorafter", transactionDate],
      "AND",
      ["custrecord_lmry_ntax_transactiontypes", "anyof", filtroTransactionType],
      "AND",
      ["custrecord_lmry_ntax_taxtype", "anyof", ["4"]],
      "AND",
      ["custrecord_lmry_ntax_gen_transaction", "anyof", "6"],
    ];

    var documents = ["@NONE@"];
    if (transactionDocumentType) {
      documents.push(transactionDocumentType);
    }
    filtrosNT.push("AND", ["custrecord_lmry_ntax_fiscal_doctype", "anyof", documents]);

    if (FEATURE_SUBSIDIARY) {
      filtrosNT.push("AND", ["custrecord_lmry_ntax_subsidiary", "anyof", subsidiary]);
    }

    var searchNT = search.create({
      type: "customrecord_lmry_national_taxes",
      columns: [
        "custrecord_lmry_ntax_taxrate",
        "internalid",
        "custrecord_lmry_ntax_sub_type",
        "custrecord_lmry_ntax_gen_transaction",
        "custrecord_lmry_ntax_department",
        "custrecord_lmry_ntax_class",
        "custrecord_lmry_ntax_location",
        "custrecord_lmry_ntax_taxtype",
        "custrecord_lmry_ntax_description",
        "custrecord_lmry_nt_invoicing_identifier",
        "custrecord_lmry_nt_ste_tax_type",
        "custrecord_lmry_nt_ste_tax_code",
        "custrecord_lmry_ntax_appliesto"
      ],
      filters: filtrosNT,
    });
    var searchResultNT = searchNT.run().getRange({
      start: 0,
      end: 1000,
    });
    return searchResultNT;
  }

    /**********************************************************
    * Busqueda en el record: LatamReady - Setup Tax Subsidiary
    **********************************************************/
    function getSetupTaxSubsidiary(subsidiary) {
      try{
        var filters = [
          ['isinactive', 'is', 'F'], 'AND'
        ];
        if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == 'T') {
          filters.push(['custrecord_lmry_setuptax_subsidiary', 'anyof', subsidiary]);
        }
    
        var search_setupSub = search.create({
          type: 'customrecord_lmry_setup_tax_subsidiary',
          filters: filters,
          columns: ['custrecord_lmry_setuptax_subsidiary', 'custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_depclassloc',
            'custrecord_lmry_setuptax_type_rounding', 'custrecord_lmry_setuptax_department', 'custrecord_lmry_setuptax_class',
            'custrecord_lmry_setuptax_location', 'custrecord_lmry_setuptax_form_bill', 'custrecord_lmry_setuptax_form_credit'
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
          setupSubsidiary["vendorbillform"] = results[0].getValue("custrecord_lmry_setuptax_form_bill") || "";
          setupSubsidiary["vendorcreditform"] = results[0].getValue("custrecord_lmry_setuptax_form_credit") || "";
        }
        return setupSubsidiary;
      }
      catch(e){
        log.error("[ aftersubmit - getSetupTaxSubsidiary ]", e);
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
    /***************************************************************************
     * BUSQUEDA DEL RECORD: LATMAREADY - SETUP TAX SUBSIDIARY
     *    - subsidiary: Subsiaria a filtrar para recuperar su configuración
     ***************************************************************************/
     function getInvoicingIdentifierJSON(invoicingIdentifier) {
      try {
          var aux1 = invoicingIdentifier.split(":");
          var aux2 = aux1[1].split(" ");
          // FORMATO ORIGINAL: AT_CO:CO_SR (Exportacion - Gravado - Reducido)
          // FORMATO NUEVO:
          // AT_CO
          // CO_SR
          // Exportacion - Gravado - Reducido
          // Expresion regular para obtener lo que esta dentro de los parentesis
          var regExp = /\(([^)]+)\)/;
          var aux3 = regExp.exec(aux1[1]);
          var aux4 = aux1[1];
          var II_JSON = {
              taxtype: aux1[0],
              taxcode: aux2[0],
              invoicing: aux3[1],
          };
          return II_JSON;
      } catch (error) {
        library.sendemail( "[ afterSubmit - getInvoicingIdentifierJSON ]: " + error, LMRY_SCRIPT );
        // Library_Log.doLog({ title: "[ afterSubmit - getInvoicingIdentifierJSON ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
      }

    }


    return {
      afterSubmitTransaction: afterSubmitTransaction,
      cleanLinesforCopy: cleanLinesforCopy,
      deleteTaxResultRC: deleteTaxResultRC
    };
     
});