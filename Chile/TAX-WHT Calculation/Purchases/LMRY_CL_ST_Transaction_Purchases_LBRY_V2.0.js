/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_CL_ST_Transaction_Purchases_LBRY_V2.0.js    ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     May 10 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

 define(["N/log", "N/format", "N/record", "N/search", "N/runtime",
 "./LMRY_libSendingEmailsLBRY_V2.0",
], function (log, format, record, search, runtime, library) {
  var LMRY_script = "LatamReady - CL ST Transaction Purchases LBRY";
  var CONFIG_TRANSACTION = {
    'vendorbill': {
      'recordtype': 'vendorcredit',
      "form": "vendorcreditform"
    },
    'vendorcredit': {
      'recordtype': 'vendorbill',
      "form": "vendorbillform"
    },
  };
  var FEATURE_TRANSACTION = {
    'vendorbill': 'CUSTOMAPPROVALVENDORBILL',
  };

  var FEATURE_SUBSIDIARIES = false;
  var FEATURE_MULTIBOOK = false;
  
  var MEMO_TRANSACTION = '(LatamTax -  WHT)';
  var MEMO_LINE = ' (LatamTax - WHT) ';
  var WHT_MEMO = 'Latam - WHT Tax';
  /*********************************************************************************************************
    * Funcion que realiza el calculo de los impuestos.
    * Para Chile: Llamada desde el User Event del Vendor Bill.
    ********************************************************************************************************/
  function afterSubmitTransaction(scriptContext, licenses) {
    try {
      var recordObj = scriptContext.newRecord;
      var userObj = runtime.getCurrentUser();
      var type = scriptContext.type;

      if (type == "create" || type == "edit" || type == "copy") {
        
        var recordId = "";
        var transactionType = "";
        recordId = scriptContext.newRecord.id;
        transactionType = scriptContext.newRecord.type;

        var override = recordObj.getValue({fieldId: "taxdetailsoverride"});
        if (override == true || override == "T") {
          
          var taxResult = [];
          var taxInformation = [];
          var TOTAL_AMOUNT_WHT = 0.0;
          
          FEATURE_SUBSIDIARIES = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});
          FEATURE_MULTIBOOK = runtime.isFeatureInEffect({feature: "MULTIBOOK"});
          
          
          var account = recordObj.getValue('account');
          var departmentTr = recordObj.getValue('department');
          var classTr = recordObj.getValue('class');
          var locationTr = recordObj.getValue('location');
          
          var subsidiary;
          
          if (FEATURE_SUBSIDIARIES) {
            subsidiary = recordObj.getValue({fieldId: "subsidiary"});
          } else {
            subsidiary = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country"});
          }
          
          var idCountry = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country"});
          var transactionDate = recordObj.getText("trandate");
          var transactionDateValue = recordObj.getValue("trandate");
          var transactionEntity = recordObj.getValue({fieldId: "entity"});
          var transactionDocumentType = recordObj.getValue({fieldId: 'custbody_lmry_document_type'});

          var filtroTransactionType;
          switch (transactionType) {
            case "vendorbill":
              filtroTransactionType = 4;
              break;
            case "vendorcredit":
              filtroTransactionType = 7;
              break;
            default:
              return recordObj;
          }

          var itemLineCount = recordObj.getLineCount({sublistId: "item"});
          var expenseLineCount = recordObj.getLineCount({ sublistId: "expense" });

          var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
          var setupTaxSubsiRounding = setupSubsidiary["rounding"]; 

          var exchangeRate = getExchangeRate(recordObj, subsidiary, setupSubsidiary);

          var CC_SearchResult = getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, transactionEntity, transactionDocumentType);
          
          if (CC_SearchResult != null && CC_SearchResult.length > 0) {

            for (var i = 0; i < CC_SearchResult.length; i++) {

              var CC_internalID = CC_SearchResult[i].getValue({ name: "internalid" });
              var CC_generatedTransaction = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_gen_transaction" });
              var CC_generatedTransactionID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_gen_transaction" });
              var CC_taxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_taxtype" });
              var CC_taxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_taxtype" });
              var CC_STE_taxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_ste_tax_type" });
              var CC_STE_taxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_cc_ste_tax_type" });
              var CC_STE_taxCode = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_ste_tax_code" });
              var CC_STE_taxCodeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_cc_ste_tax_code" });
              var CC_subtypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
              var CC_subtype = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
              var CC_taxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxrate" });
              var CC_isExempt = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_isexempt" });
              var CC_invIdent = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_invoice_identifier" });
              var CC_invIdentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_cc_invoice_identifier" });
              var CC_Department = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_department" });
              var CC_DepartmentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_department" });
              var CC_Class = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_class" });
              var CC_ClassID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_class" });
              var CC_Location = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_location" });
              var CC_LocationID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_location" });
              var CC_taxItem = CC_SearchResult[i].getValue({name: "custrecord_lmry_ar_ccl_taxitem"});
              var CC_taxToItem = CC_SearchResult[i].getValue({name: "custrecord_lmry_ccl_applies_to_item"});
              var CC_taxToAccount = CC_SearchResult[i].getValue({name: "custrecord_lmry_ccl_applies_to_account"});
              var CC_taxCode = CC_SearchResult[i].getValue({name: "custrecord_lmry_ar_ccl_taxcode"});
              
              if (itemLineCount != null && itemLineCount > 0) {

                var lastDetailLine = 0;

                for (var j = 0; j < itemLineCount; j++) {

                  var item = recordObj.getSublistText({ sublistId: 'item', fieldId: 'item', line: j });
                  var itemID = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                  var itemUniqueKey = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: j });
                  var itemInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'item', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: j });
                  var itemDetailReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: j });
                  var itemNetAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j }) || 0.0;

                  if (CC_taxTypeID == '4') {
                    
                    if ( itemInvoiceIdentifier != null && itemInvoiceIdentifier != "" ) {
                      
                      var II_JSON = getInvoicingIdentifierJSON(itemInvoiceIdentifier);
                      log.debug('[ II_JSON ]', II_JSON);
    
                      if ((CC_invIdent == II_JSON.invoicing) && (CC_STE_taxType == II_JSON.taxtype) && (CC_STE_taxCode == II_JSON.taxcode)) {

                        var taxAmountNoRounded = parseFloat(itemNetAmount) * parseFloat(CC_taxRate);
                        var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);
                      
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: itemDetailReference });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: CC_STE_taxTypeID });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: CC_STE_taxCodeID });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(itemNetAmount) });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(CC_taxRate) * 100 });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: taxAmount });

                        taxResult.push({
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
                          position: j,
                          description: "",
                          lc_baseamount: parseFloat(itemNetAmount * exchangeRate),
                          lc_taxamount: parseFloat(taxAmountNoRounded * exchangeRate),
                          lc_grossamount: parseFloat(parseFloat(itemNetAmount + taxAmountNoRounded) * exchangeRate)
                        });
    
                        lastDetailLine += 1;

                      }
                    } else {
                        break;
                    }
                  }
                  else if (CC_taxTypeID == '1') {

                    if (CC_taxToItem == itemID) {

                      taxInformation.push([CC_taxItem, CC_taxCode]);
                      var taxAmountNoRounded = parseFloat(itemNetAmount) * parseFloat(CC_taxRate);
                      var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);
  
                      taxResult.push({
                        taxtype: {
                          text: CC_taxType,
                          value: CC_taxTypeID
                        },
                        subtype: {
                          text: CC_subtypeID,
                          value: CC_subtype
                        },
                        lineuniquekey: itemUniqueKey,
                        baseamount: parseFloat(itemNetAmount),
                        whtamount: taxAmount,
                        whtrate: CC_taxRate,
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
                        position: j,
                        description: "",
                        lc_baseamount: parseFloat(itemNetAmount * exchangeRate),
                        lc_whtamount: parseFloat(taxAmountNoRounded * exchangeRate),
                      });
                    }
                    else {
                      continue;
                    }
                  }
                } // FIN FOR ITEM COUNT
              } // FIN IF ITEM COUNT

              if (expenseLineCount != null && expenseLineCount > 0) {

                for (var j = 0; j < expenseLineCount; j++) {
                    
                  var account = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'account', line: j });
                  var accountID = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'account', line: j });
                  var expenseUniqueKey = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'lineuniquekey', line: j });
                  var expenseInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: j });
                  var expenseDetailReference = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'taxdetailsreference', line: j });
                  var expenseNetAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j }) || 0.0;
                  
                  if (CC_taxTypeID == '4') {
                    
                    if( expenseInvoiceIdentifier != null && expenseInvoiceIdentifier != "" ) {
                      var II_JSON = getInvoicingIdentifierJSON(expenseInvoiceIdentifier);
                      log.debug('[ II_JSON ]', II_JSON);
                      
                      if ((CC_invIdent == II_JSON.invoicing) && (CC_STE_taxType == II_JSON.taxtype) && (CC_STE_taxCode == II_JSON.taxcode)) {
                          
                        var taxAmountNoRounded = parseFloat(expenseNetAmount) * parseFloat(CC_taxRate);
                        var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);

                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: expenseDetailReference });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: CC_STE_taxTypeID });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: CC_STE_taxCodeID });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(expenseNetAmount) });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(CC_taxRate) * 100 });
                        recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: taxAmount });

                        taxResult.push({
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
                          lineuniquekey: expenseUniqueKey,
                          baseamount: parseFloat(expenseNetAmount),
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
                          item: {},
                          expenseacc: {
                              text: account,
                              value: accountID
                          },
                          position: j,
                          description: "",
                          lc_baseamount: parseFloat(expenseNetAmount * exchangeRate),
                          lc_taxamount: parseFloat(taxAmountNoRounded * exchangeRate),
                          lc_grossamount: parseFloat(parseFloat(expenseNetAmount + taxAmountNoRounded) * exchangeRate)
                        });

                        lastDetailLine += 1;
    
                      }
                    } else {
                      break;
                    }
                  }
                  else if (CC_taxTypeID == '1') {

                    if (CC_taxToAccount == accountID) {

                      taxInformation.push([CC_taxItem, CC_taxCode]);
                      var taxAmountNoRounded = parseFloat(expenseNetAmount) * parseFloat(CC_taxRate);
                      var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);
  
                      taxResult.push({
                        taxtype: {
                          text: CC_taxType,
                          value: CC_taxTypeID
                        },
                        subtype: {
                          text: CC_subtypeID,
                          value: CC_subtype
                        },
                        lineuniquekey: expenseUniqueKey,
                        baseamount: parseFloat(expenseNetAmount),
                        whtamount: taxAmount,
                        whtrate: CC_taxRate,
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
                        item: {},
                        expenseacc: {
                            text: account,
                            value: accountID
                        },
                        position: j,
                        description: "",
                        lc_baseamount: parseFloat(expenseNetAmount * exchangeRate),
                        lc_whtamount: parseFloat(taxAmountNoRounded * exchangeRate),
                      });
                    }
                    else {
                      continue;
                    }
                  }
                } // FIN FOR EXPENSE COUNT
              } // FIN IF EXPENSE COUNT
            } // FIN FOR CONTRIBUTORY CLASS
          } // FIN IF CONTRIBUTORY CLASS
          else { 
            var NT_SearchResult = getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, transactionDocumentType);
            log.error("NT_SearchResult", NT_SearchResult.length)
            if (NT_SearchResult != null && NT_SearchResult.length > 0) {
              
              for (var i = 0; i < NT_SearchResult.length; i++) {

                var NT_internalID = NT_SearchResult[i].getValue({ name: "internalid" });
                var NT_generatedTransaction = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_gen_transaction" });
                var NT_generatedTransactionID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_gen_transaction" });
                var NT_taxType = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_taxtype" });
                var NT_taxTypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxtype" });
                var NT_STE_taxType = NT_SearchResult[i].getText({ name: "custrecord_lmry_nt_ste_tax_type" });
                var NT_STE_taxTypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_nt_ste_tax_type" });
                var NT_STE_taxCode = NT_SearchResult[i].getText({ name: "custrecord_lmry_nt_ste_tax_code" });
                var NT_STE_taxCodeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_nt_ste_tax_code" });
                var NT_taxRate = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxrate" });
                var NT_subtype = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_sub_type" });
                var NT_subtypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_sub_type" });
                var NT_isExempt = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_isexempt" });
                var NT_invIdent = NT_SearchResult[i].getText({ name: "custrecord_lmry_nt_invoicing_identifier" });
                var NT_invIdentID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_nt_invoicing_identifier" });
                var NT_Department = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_department" });
                var NT_DepartmentID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_department" });
                var NT_Class = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_class" });
                var NT_ClassID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_class" });
                var NT_Location = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_location" });
                var NT_LocationID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_location" });
                var NT_taxItem = NT_SearchResult[i].getValue({name: "custrecord_lmry_ntax_taxitem"});
                var NT_taxToItem = NT_SearchResult[i].getValue({name: "custrecord_lmry_ntax_applies_to_item"});
                var NT_taxToAccount = NT_SearchResult[i].getValue({name: "custrecord_lmry_ntax_applies_to_account"});
                var NT_taxCode = NT_SearchResult[i].getValue({name: "custrecord_lmry_ntax_taxcode"});

                var lastDetailLine = 0;

                if (itemLineCount != null && itemLineCount > 0) {
                  
                  for (var j = 0; j < itemLineCount; j++) {

                    var item = recordObj.getSublistText({ sublistId: 'item', fieldId: 'item', line: j });
                    var itemID = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                    var itemUniqueKey = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: j });
                    var itemInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'item', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: j });
                    var itemDetailReference = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'taxdetailsreference', line: j });
                    var itemNetAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j }) || 0.0;
                    
                    if (NT_taxTypeID == '4') {
                      
                      if( itemInvoiceIdentifier != null && itemInvoiceIdentifier != "" ) {

                        var II_JSON = getInvoicingIdentifierJSON(itemInvoiceIdentifier);
                        log.debug('[ II_JSON ]', II_JSON);
    
                        if ((NT_invIdent == II_JSON.invoicing) && (NT_STE_taxType == II_JSON.taxtype) && (NT_STE_taxCode == II_JSON.taxcode)) {
    
                          var taxAmountNoRounded = parseFloat(itemNetAmount) * parseFloat(NT_taxRate);
                          var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);
    
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: itemDetailReference });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: NT_STE_taxTypeID });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: NT_STE_taxCodeID });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(itemNetAmount) });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(NT_taxRate) * 100 });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: taxAmount });
                          
                          taxResult.push({
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
                        }
                      } else {
                          break;
                      }
                    }
                    else if (NT_taxTypeID == '1') {

                      if (NT_taxToItem == itemID) {

                        taxInformation.push([NT_taxItem, NT_taxCode]);
    
                        var taxAmountNoRounded = parseFloat(itemNetAmount) * parseFloat(NT_taxRate);
                        var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);
                        
                        taxResult.push({
                          taxtype: {
                            text: NT_taxType,
                            value: NT_taxTypeID
                          },
                          subtype: {
                            text: NT_subtype,
                            value:  NT_subtypeID
                          },
                          lineuniquekey: itemUniqueKey,
                          baseamount: parseFloat(itemNetAmount),
                          whtamount: taxAmount,
                          whtrate: NT_taxRate,
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
                          lc_whtamount: parseFloat(taxAmountNoRounded * exchangeRate),
                        });
                      }
                      else {
                        continue;
                      }
                    }
                  } // FIN FOR ITEM COUNT
                } // FIN IF ITEM COUNT
                
                if (expenseLineCount != null && expenseLineCount > 0) {

                  for (var j = 0; j < expenseLineCount; j++) {

                    var account = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'account', line: j });
                    var accountID = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'account', line: j });
                    var expenseUniqueKey = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'lineuniquekey', line: j });
                    var expenseInvoiceIdentifier = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'custcol_lmry_taxcode_by_inv_ident', line: j });
                    var expenseDetailReference = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'taxdetailsreference', line: j });
                    var expenseNetAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j }) || 0.0;

                    if (NT_taxTypeID == '4') {

                      if( expenseInvoiceIdentifier != null && expenseInvoiceIdentifier != "" ) {

                        var II_JSON = getInvoicingIdentifierJSON(expenseInvoiceIdentifier);
                        log.debug('[ II_JSON ]', II_JSON);
                        
                        if ((NT_invIdent == II_JSON.invoicing) && (NT_STE_taxType == II_JSON.taxtype) && (NT_STE_taxCode == II_JSON.taxcode)) {
                          
                          var taxAmountNoRounded = parseFloat(expenseNetAmount) * parseFloat(NT_taxRate);
                          var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);
    
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: expenseDetailReference });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: NT_STE_taxTypeID });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: NT_STE_taxCodeID });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(expenseNetAmount) });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: lastDetailLine, value: parseFloat(NT_taxRate) * 100 });
                          recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: lastDetailLine, value: taxAmount });
    
                          taxResult.push({
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
                            lineuniquekey: expenseUniqueKey,
                            baseamount: parseFloat(expenseNetAmount),
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
                            item: {},
                            expenseacc: {
                              text: account,
                              value: accountID
                            },
                            position: i,
                            description: "",
                            lc_baseamount: parseFloat(expenseNetAmount * exchangeRate),
                            lc_taxamount: parseFloat(taxAmountNoRounded * exchangeRate),
                            lc_grossamount: parseFloat(parseFloat(expenseNetAmount + taxAmountNoRounded) * exchangeRate)
                          });
    
                          lastDetailLine += 1;
    
                        }
                      } else {
                          break;
                      }
                    }
                    else if (NT_taxTypeID == '1') {

                      if (NT_taxToAccount == accountID) {

                        taxInformation.push([NT_taxItem, NT_taxCode]);
  
                        var taxAmountNoRounded = parseFloat(expenseNetAmount) * parseFloat(NT_taxRate);
                        var taxAmount = typeRounding(taxAmountNoRounded, setupTaxSubsiRounding);
  
                        taxResult.push({
                          taxtype: {
                            text: NT_taxType,
                            value: NT_taxTypeID
                          },
                          subtype: {
                            text: NT_subtype,
                            value: NT_subtypeID
                          },
                          lineuniquekey: expenseUniqueKey,
                          baseamount: parseFloat(expenseNetAmount),
                          whtamount: taxAmount,
                          whtrate: NT_taxRate,
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
                          item: {},
                          expenseacc: {
                            text: account,
                            value: accountID
                          },
                          position: i,
                          description: "",
                          lc_baseamount: parseFloat(expenseNetAmount * exchangeRate),
                          lc_whtamount: parseFloat(taxAmountNoRounded * exchangeRate),
                        });
                      }
                    }
                  } // FIN FOR EXPENSE COUNT
                } // FIN IF EXPENSE COUNT
              } // FIN FOR NATIONAL TAX
            } // FIN IF NATIONAL TAX
          }

          var TResultTax = [];
          var TResultWth = [];
          
          for (var i = 0; i < taxResult.length; i++) {
            if (taxResult[i]["taxtype"]["value"] == '4'){
              TResultTax.push(taxResult[i]);
            }
            // Si hay CC o NT de Retencion
            else if (taxResult[i]["taxtype"]["value"] == '1') {
              TResultWth.push(taxResult[i]);
            }
          }
          log.error("TResultWth", TResultWth.length)
          //Se crea un Bill Credit si hay retenciones
          var featureWth = true;
          if (licenses) {
            featureWth = library.getAuthorization(628, licenses);
          }
          if (TResultWth.length > 0 && featureWth == true) {
            if (FEATURE_TRANSACTION[transactionType]) {
              var approvalFeature = runtime.getCurrentScript().getParameter({name: FEATURE_TRANSACTION[transactionType]});
            }

            var approvalStatus = 0;
            approvalStatus = recordObj.getValue({fieldId: 'approvalstatus'});

            if ((approvalFeature == false || approvalFeature == 'F') || ((approvalFeature == true || approvalFeature == 'T') && (approvalStatus && Number(approvalStatus) == 2))) {
              log.error("taxInformation", taxInformation);
              createWHTTransaction(recordObj, TResultWth, taxInformation);
            } // Fin IF status
          } // Fin IF TResultWth

          saveTaxResult(recordId, subsidiary, idCountry, transactionDateValue, TResultTax, TResultWth);
        
        } // Fin if taxdetailsoverride
      } // Fin if create, edit o copy
    } catch (err) {
      log.error("Error AfterSubmit", err);
      // library.sendemail(" [ After Submit ] " + err, LMRY_script);
    }
    return recordObj;
  }

  function createWHTTransaction(recordObj, taxResults, taxInformation) {
    try {
      var recordType = recordObj.getValue('baserecordtype');
  
      var idTransaction = recordObj.id;
      var idNewRecord = null;
  
      if (CONFIG_TRANSACTION[recordType]) {
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
  
        var fromType = "vendorbill";
        var fromId = idTransaction;
        if (recordType == "vendorcredit") {
          fromType = "customer";
          fromId = entity;
        }
        var toType = CONFIG_TRANSACTION[recordType]['recordtype'];
        
        var TOTAL_AMOUNT_WHT = 0.0;

        var recordTransaction = record.transform({
          fromType: fromType,
          fromId: fromId,
          toType: toType,
          isDynamic: false
        });

        if (toType == "vendorbill") {
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

        //Tax Detail feature
        recordTransaction.setValue('taxdetailsoverride', true);

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

        //Limpiar campos copiados del bill
        recordTransaction.setValue('custbody_lmry_document_type', '');
        recordTransaction.setValue('custbody_lmry_serie_doc_cxc', '');
        recordTransaction.setValue('custbody_lmry_num_preimpreso', '');
        recordTransaction.setValue('custbody_lmry_informacion_adicional', '');
        recordTransaction.setValue('custbody_lmry_apply_wht_code', false);

        //Tax Detail feature
        recordTransaction.setValue('taxdetailsoverride', true);

        //Campos de facturacion
        if (recordTransaction.getField({fieldId: 'custbody_psg_ei_template'})) {
          recordTransaction.setValue('custbody_psg_ei_template', '');
        }

        if (recordTransaction.getField({fieldId: 'custbody_psg_ei_status'})) {
          recordTransaction.setValue('custbody_psg_ei_status', '');
        }

        if (recordTransaction.getField({fieldId: 'custbody_psg_ei_sending_method'})) {
          recordTransaction.setValue('custbody_psg_ei_sending_method', '');
        }

        if (recordTransaction.getField({fieldId: 'custbody_psg_ei_generated_edoc'})) {
          recordTransaction.setValue('custbody_psg_ei_generated_edoc', '');
        }

        if (toType == "vendorcredit") {
          removeAllItems(recordTransaction);
          removeAllTaxDetails(recordTransaction);
          removeAllExpenses(recordTransaction);
        }

        var amountWHT = 0.0; 
        for (var i = 0; i < taxResults.length; i++) {
          var taxResult = taxResults[i];
          var taxItem = taxInformation[i][0];
          var taxCode = taxInformation[i][1];
          var taxType = search.lookupFields({type: 'salestaxitem', id: taxCode, columns: ["taxtype"]});
          taxType = taxType.taxtype[0].value;
          amountWHT += taxResult["whtamount"];

          recordTransaction.insertLine({sublistId: 'item',line: i});
          recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'item', value: taxItem, line: i});
          recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'rate', value: taxResult["whtamount"], line: i});
          recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'amount', value: taxResult["whtamount"], line: i});
  
          var description = taxResult["subtype"]["text"] + MEMO_LINE;
  
          recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'description', value: description, line: i});
  
          if (departmentFeat == true || departmentFeat == 'T') {
            var depField = recordTransaction.getSublistField({sublistId: 'item', fieldId: 'department', line: i});
            var departmentLine = taxResult["department"]["value"];
            departmentLine = departmentLine || departmentTr || "";
  
            if (depField && departmentLine) {
              recordTransaction.setSublistValue({ sublistId: 'item', fieldId: 'department', value: departmentLine, line: i});
            }
          }
  
          if (classFeat == true || classFeat == 'T') {
            var classField = recordTransaction.getSublistField({ sublistId: 'item', fieldId: 'class', line: i});
            var classLine = taxResult["class"]["value"];
            classLine = classLine || classTr || "";

            if (classField && classLine) {
              recordTransaction.setSublistValue({ sublistId: 'item', fieldId: 'class', value: classLine, line: i});
            }
          }
  
          if (locationFeat == true || locationFeat == 'T') {
            var locField = recordTransaction.getSublistField({sublistId: 'item', fieldId: 'location', line: i});
            var locationLine = taxResult["location"]["value"];
            locationLine = locationLine || locationTr || "";
  
            if (locField && locationLine) {
              recordTransaction.setSublistValue({ sublistId: 'item', fieldId: 'location', value: locationLine, line: i});
            }
          }
  
          // recordTransaction.setSublistValue({
          //   sublistId: 'item',
          //   fieldId: 'custcol_lmry_ar_perception_amount',
          //   value: taxResult['baseamount'],
          //   line: i
          // });
  
          // recordTransaction.setSublistValue({
          //   sublistId: 'item',
          //   fieldId: 'custcol_lmry_ar_perception_percentage',
          //   value: taxResult['taxrate'],
          //   line: i
          // });
        }

        if (toType == "vendorcredit") {
          //si se genero un vendorcredit se aplica el bill de donde se creo.
          var numApply = recordTransaction.getLineCount({sublistId: 'apply'});
          for (var j = 0; j < numApply; j++) {
            var lineTransaction = recordTransaction.getSublistValue({ sublistId: 'apply', fieldId: 'internalid', line: j});
            
            if (Number(lineTransaction) == Number(idTransaction)) {
              recordTransaction.setSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true, line: j});
              recordTransaction.setSublistValue({ sublistId: 'apply', fieldId: 'amount', value: parseFloat(amountWHT), line: j});
              break;
            }
          }
        }
        idNewRecord = recordTransaction.save({
          ignoreMandatoryFields: true,
          disableTriggers: true,
          enableSourcing: true
        });

        idNewRecord = setTaxDetailBillCredit(recordObj, idNewRecord, taxResults, taxCode, taxType);
        log.error("ID New Bill Credit", idNewRecord);
        
        if (idNewRecord) {
          TOTAL_AMOUNT_WHT = search.lookupFields({
            type: CONFIG_TRANSACTION[recordType]['recordtype'],
            id: idNewRecord,
            columns: ["fxamount"]
          }).fxamount || 0.00;
        }
        recordObj.setValue({ fieldId: 'custbody_lmry_wtax_amount', value: Math.abs(parseFloat(TOTAL_AMOUNT_WHT))});
        recordObj.setValue({ fieldId: 'custbody_lmry_wtax_code_des', value: WHT_MEMO});

        // if (idNewRecord) {
        //   TOTAL_AMOUNT_WHT += parseFloat(search.lookupFields({
        //     type: toType,
        //     id: idNewRecord,
        //     columns: ["fxamount"]
        //   }).fxamount) || 0.00;
        // }
        // log.error('TOTAL_AMOUNT_WHT', TOTAL_AMOUNT_WHT);
        
        // record.submitFields({
        //   type: recordType,
        //   id: idTransaction,
        //   values: {
        //     'custbody_lmry_wtax_amount': Math.abs(parseFloat(TOTAL_AMOUNT_WHT)),
        //     'custbody_lmry_wtax_code_des': WHT_MEMO
        //   },
        //   options: {
        //     disableTriggers: true   
        //   }
        // });
      } 
    }
    catch (e){
      log.error('[' + LMRY_script + ' - createWHTTransaction]', e);
    }
  }

  function setTaxDetailBillCredit(recordObj, vendorcreditId, TResultWth, taxCode, taxType) {
    try{
      var recordCredit = record.load({
        type: 'vendorcredit',
        id: vendorcreditId,
        isDynamic: false
      });

      

      // Tax Details fields del Vendor Bill
      var nexus = recordObj.getValue({ fieldId: 'nexus' });
      var nexusOverRide = recordObj.getValue({ fieldId: 'taxregoverride' });
      var TType = recordObj.getValue({ fieldId: 'custbody_ste_transaction_type' });
      var subTaxRegNumber = recordObj.getValue({ fieldId: 'subsidiarytaxregnum' });
      var entityTaxRegNumber = recordObj.getValue({ fieldId: 'entitytaxregnum' });

      // Tax Details fields al VendorBill
      recordCredit.setValue({ fieldId: 'nexus', value: nexus });
      recordCredit.setValue({ fieldId: 'taxregoverride', value: nexusOverRide });
      recordCredit.setValue({ fieldId: 'custbody_ste_transaction_type', value: TType });
      recordCredit.setValue({ fieldId: 'subsidiarytaxregnum', value: subTaxRegNumber });
      recordCredit.setValue({ fieldId: 'entitytaxregnum', value: entityTaxRegNumber });

      var lineCount = recordCredit.getLineCount({
        sublistId: 'item'
      });
      for (var i = 0; i < lineCount; i++) {
        var taxDetailsReference = recordCredit.getSublistValue({
          sublistId: "item",
          fieldId: "taxdetailsreference",
          line: i
        });
  
        var itemId = recordCredit.getSublistValue({
          sublistId: "item",
          fieldId: "item",
          line: i
        });
        var amountItem = parseFloat(
          recordCredit.getSublistValue({
            sublistId: "item",
            fieldId: "amount",
            line: i
          })
        );
        var taxRate = 0.0;
        var taxBasis = 0.0;
        taxRate = parseFloat(TResultWth[i]["whtrate"]) * 100;
        taxBasis = TResultWth[i]["baseamount"];
        
        recordCredit.insertLine({sublistId: 'taxdetails',line: i});
        recordCredit.setSublistValue({
          sublistId: "taxdetails",
          fieldId: "taxdetailsreference",
          line: i,
          value: taxDetailsReference
        });
        recordCredit.setSublistValue({
          sublistId: "taxdetails",
          fieldId: "taxtype",
          line: i,
          value: taxType
        });
        recordCredit.setSublistValue({
          sublistId: "taxdetails",
          fieldId: "taxcode",
          line: i,
          value: taxCode
        });
        recordCredit.setSublistValue({
          sublistId: "taxdetails",
          fieldId: "taxbasis",
          line: i, 
          value: taxBasis 
        });
        recordCredit.setSublistValue({
          sublistId: "taxdetails",
          fieldId: "taxrate",
          line: i,
          value: taxRate 
        });
        recordCredit.setSublistValue({
          sublistId: "taxdetails",
          fieldId: "taxamount",
          line: i,
          value: 0.00
        });
        
      }
      var idNewRecord = recordCredit.save({
        ignoreMandatoryFields: true,
        disableTriggers: true,
        enableSourcing: true
      });
      return idNewRecord;

    }catch(e){
      log.error("[ aftersubmit - setTaxDetailBillCredit ]", e);
    }
  }
  
  /***************************************************************************
  * GUARDAR TAX RESULT EN EL RECORD: LATAMREADY - LATAMTAX TAX RESULT
  *    - transaction: ID de la Transaccion
  *    - subsidiary: Subsidiaria
  *    - country: Pais
  *    - transactionDate: Fecha de la transacción
  *    - TResultWth: JSON de Tax Results
  ***************************************************************************/
  function saveTaxResult(transaction, subsidiary, country, transactionDate, TResultTax, TResultWth) {
    try {
      var resultSearchTR = search.create({
          type: "customrecord_lmry_ste_json_result",
          columns: ["internalid"],
          filters: ["custrecord_lmry_ste_related_transaction","is", transaction],
        }).run().getRange({ start: 0, end: 10 });

      if (resultSearchTR != null && resultSearchTR.length > 0) {
        var recordId = resultSearchTR[0].getValue("internalid");

        record.submitFields({
          type: "customrecord_lmry_ste_json_result",
          id: recordId,
          values: {
            custrecord_lmry_ste_subsidiary: subsidiary,
            custrecord_lmry_ste_subsidiary_country: country,
            custrecord_lmry_ste_transaction_date: transactionDate,
            custrecord_lmry_ste_tax_transaction: JSON.stringify(TResultTax),
            custrecord_lmry_ste_wht_transaction: JSON.stringify(TResultWth)
          },
          options: {
            enableSourcing: false,
            ignoreMandatoryFields: true,
          },
        });
      } else {
        var recordTR = record.create({
          type: "customrecord_lmry_ste_json_result",
          isDynamic: false,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_ste_related_transaction",
          value: transaction,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_ste_subsidiary",
          value: subsidiary,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_ste_subsidiary_country",
          value: country,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_ste_transaction_date",
          value: transactionDate,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_ste_tax_transaction",
          value: JSON.stringify(TResultTax),
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_ste_wht_transaction",
          value: JSON.stringify(TResultWth),
        });
        recordTR.save({
          enableSourcing: true,
          ignoreMandatoryFields: true,
          disableTriggers: true,
        });
      }
    } 
    catch (error) {
      // log.error("saveTaxResult", error)
      Library_Mail.sendemail('[ saveTaxResult ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ saveTaxResult ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }
  
  function cleanLinesforCopy(RCD_TRANS, LICENSES) {
    try {
      var numLineas = RCD_TRANS.getLineCount({
        sublistId: "item"
      });

      //var featureMultiPrice = runtime.isFeatureInEffect({ feature: 'multprice' });

      RCD_TRANS.setValue({
        fieldId: "custbody_lmry_informacion_adicional",
        value: "",
      });

      for (var i = 0; i < numLineas; i++) {
        var amountItem = RCD_TRANS.getSublistValue({
          sublistId: "item",
          fieldId: "amount",
          line: i
        });
        RCD_TRANS.setSublistValue("item", "taxamount", i, 0);
        RCD_TRANS.setSublistValue("item", "grossamt", i, amountItem);

        RCD_TRANS.removeLine({ sublistId: "taxdetails", line: 0 });
      }
    } catch (err) {
      library.sendemail(" [ cleanLinesforCopy ] " + err, LMRY_script);
    }
  }

  function deleteTaxResult(transaction) {
    try {
      var resSearch = search.create({
          type: "customrecord_lmry_latamtax_tax_result",
          columns: ["id"],
          filters: [
            "custrecord_lmry_tr_related_transaction",
            "is",
            transaction,
          ],
        }).run().getRange({ start: 0, end: 10 });
      if (resSearch != null && resSearch.length > 0) {
        var recordId = resSearch[0].getValue("id");
        record.delete({
          type: "customrecord_lmry_latamtax_tax_result",
          id: recordId,
        });
      }
    } catch (e) {
      log.error("[ deleteTaxResult ]", e);
      //library.sendemail(" [ deleteTaxResult ] " + err, LMRY_script);
    }
  }

  function removeAllItems(recordObj) {
    try{
      while (true) {
        var numberItems = recordObj.getLineCount({
          sublistId: 'item'
        });
        if (numberItems > 0) {
          recordObj.removeLine({
            sublistId: 'item',
            line: numberItems - 1
          });
        } else {
          break;
        }
      }
    }
    catch (e) {
      log.error("[ aftersubmit - removeAllItems ]", e);
    }
  }

  function removeAllExpenses(recordObj) {
    try{
      while (true) {
        var numberExpenses = recordObj.getLineCount({sublistId: 'expense'});
        if (numberExpenses > 0) {
          recordObj.removeLine({sublistId: 'expense', line: numberExpenses - 1});
        } else {
          break;
        }
      }
    }
    catch (e) {
      log.error("[ aftersubmit - removeAllExpenses ]", e);
    }
  }

  function removeAllTaxDetails(recordObj) {
    try{
      while (true) {
        var numberTaxDetails = recordObj.getLineCount({
          sublistId: 'taxdetails'
        });
        if (numberTaxDetails > 0) {
          recordObj.removeLine({
            sublistId: 'taxdetails',
            line: numberTaxDetails - 1
          });
        } else {
          break;
        }
      }
    }
    catch (e) {
      log.error("[ aftersubmit - removeAllTaxDetails ]", e);
    }
  }

  
  /**********************************************************
    * Busqueda en el record: LatamReady - Setup Tax Subsidiary
  **********************************************************/
  function getSetupTaxSubsidiary(subsidiary) {
    try{
      var filters = [
        ['isinactive', 'is', 'F'], 'AND'
      ];
      if (FEATURE_SUBSIDIARIES == true || FEATURE_SUBSIDIARIES == 'T') {
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

  /*******************************************************************************************
    * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
  *******************************************************************************************/
  function getExchangeRate (recordObj, subsidiary, setupSubsidiary){
    try{
      var exchangeRate = 1;
  
      if (FEATURE_SUBSIDIARIES && FEATURE_MULTIBOOK) {
        // OneWorld y Multibook
        var currencySubs = search.lookupFields({
          type: "subsidiary",
          id: subsidiary,
          columns: ["currency"],
        });
        currencySubs = currencySubs.currency[0].value;
  
        if (currencySubs != setupSubsidiary['currency'] && setupSubsidiary['currency'] != "" && setupSubsidiary['currency'] != null) {
          var lineasBook = recordObj.getLineCount({
            sublistId: "accountingbookdetail",
          });
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
   * BUSQUEDA DEL RECORD: LATAMREADY - CONTRIBUTORY CLASS
   *    - subsidiary: Subsiaria
   *    - transactionDate: Fecha de creación de la transacción
   *    - filtroTransactionType: Vendor Bill
   *    - entity: ID de la Entidad
   *    - documentType: Tipo de Documento Fiscal
   ***************************************************************************/
    function getContributoryClasses (subsidiary, transactionDate, filtroTransactionType, entity, documentType) {
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
      ["custrecord_lmry_ccl_taxtype", "anyof", ["1","4"]], //1:Retencion, 2:Percepcion, 3:Detraccion, 4:Calculo de Impuesto
      "AND",
      ["custrecord_lmry_ccl_gen_transaction", "anyof", "3"], //1:Journal, 2:SuiteGL, 3:LatamTax(Purchase), 4:Add Line, 5: WhtbyTrans, LatamTax (Sales)
    ];

    var documents = ["@NONE@"];
    if (documentType) {
      documents.push(documentType);
    }
    filtrosCC.push("AND", ["custrecord_lmry_ccl_fiscal_doctype", "anyof", documents]);

    if (FEATURE_SUBSIDIARIES) {
      filtrosCC.push("AND", ["custrecord_lmry_ar_ccl_subsidiary", "anyof", subsidiary]);
    }

    var searchCC = search.create({
      type: "customrecord_lmry_ar_contrib_class",
      columns: [
        "custrecord_lmry_ar_ccl_taxrate",
        "internalid",
        "custrecord_lmry_ccl_taxtype",
        "custrecord_lmry_sub_type",
        "custrecord_lmry_ccl_gen_transaction",
        "custrecord_lmry_ar_ccl_department",
        "custrecord_lmry_ar_ccl_class",
        "custrecord_lmry_ar_ccl_location",
        "custrecord_lmry_ar_ccl_taxitem",
        "custrecord_lmry_ccl_description",
        "custrecord_lmry_cc_invoice_identifier",
        "custrecord_lmry_cc_ste_tax_type",
        "custrecord_lmry_cc_ste_tax_code",
        "custrecord_lmry_ccl_applies_to_item",
        "custrecord_lmry_ccl_applies_to_account",
        "custrecord_lmry_ar_ccl_taxcode"
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
     * BUSQUEDA DEL RECORD: LATAMREADY - NATIONAL TAX
     *    - subsidiary: Subsiaria
     *    - transactionDate: Fecha de creación de la transacción
     *    - filtroTransactionType: Vendor Bill
     *    - documentType: Tipo de Documento Fiscal
     ***************************************************************************/
    function getNationalTaxes ( subsidiary, transactionDate, filtroTransactionType, documentType ) {
    var filtrosNT = [
      ["isinactive", "is", "F"],
      "AND",
      ["custrecord_lmry_ntax_datefrom", "onorbefore", transactionDate],
      "AND",
      ["custrecord_lmry_ntax_dateto", "onorafter", transactionDate],
      "AND",
      ["custrecord_lmry_ntax_transactiontypes", "anyof", filtroTransactionType],
      "AND",
      ["custrecord_lmry_ntax_taxtype", "anyof", ["1", "4"]],
      "AND",
      ["custrecord_lmry_ntax_gen_transaction", "anyof", "3"],
    ];

    var documents = ["@NONE@"];
    if (documentType) {
      documents.push(documentType);
    }
    filtrosNT.push("AND", ["custrecord_lmry_ntax_fiscal_doctype", "anyof", documents]);

    if (FEATURE_SUBSIDIARIES) {
      filtrosNT.push("AND", ["custrecord_lmry_ntax_subsidiary", "anyof", subsidiary]);
    }

    var searchNT = search.create({
      type: "customrecord_lmry_national_taxes",
      columns: [
        "custrecord_lmry_ntax_taxrate",
        "internalid",
        "custrecord_lmry_ntax_taxtype",
        "custrecord_lmry_ntax_sub_type",
        "custrecord_lmry_ntax_gen_transaction",
        "custrecord_lmry_ntax_department",
        "custrecord_lmry_ntax_class",
        "custrecord_lmry_ntax_location",
        "custrecord_lmry_ntax_taxitem",
        "custrecord_lmry_nt_invoicing_identifier",
        "custrecord_lmry_nt_ste_tax_type",
        "custrecord_lmry_nt_ste_tax_code",
        "custrecord_lmry_ntax_appliesto",
        "custrecord_lmry_ntax_taxcode",
        "custrecord_lmry_ntax_applies_to_account",
        "custrecord_lmry_ntax_applies_to_item",
        "custrecord_lmry_ntax_subtype"
      ],
      filters: filtrosNT,
    });
    var searchResultNT = searchNT.run().getRange({
      start: 0,
      end: 1000,
    });
    return searchResultNT;
  }

  function deleteGeneratedRecords(recordObj) {
    try {
      if (recordObj.id) {
        var transactionType = recordObj.getValue('baserecordtype');

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

        if (transactionType == "vendorcredit" && whtTransactions.length) {

          var recordTransaction = record.load({
            type: "vendorcredit",
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
              recordTransaction.setSublistValue({
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
      //library_mail.sendemail('[ deleteGeneratedRecords ] ' + err, LMRY_script);
      log.error("[ deleteGeneratedRecords ]", e);
    }
  }

  function round2(num) {
    return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-14) / 1e2);
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
    deleteGeneratedRecords: deleteGeneratedRecords,
    deleteTaxResult: deleteTaxResult
  };
});
