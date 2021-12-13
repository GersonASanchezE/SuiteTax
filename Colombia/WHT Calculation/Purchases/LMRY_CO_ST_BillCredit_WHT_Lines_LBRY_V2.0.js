/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_CO_ST_BillCredit_WHT_Lines_LBRY_V2.0.js     ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Dic 03 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

 define(["N/log", 
  "N/format", 
  "N/record", 
  "N/search", 
  "N/runtime", 
  "./LMRY_libSendingEmailsLBRY_V2.0", 
  './LMRY_Log_LBRY_V2.0'
],
function (log, format, record, search, runtime, Library_Mail, Library_Log) {
  var LMRY_SCRIPT = "LatamReady - CO ST Bill Credit WHT Lines LBRY";
  var LMRY_SCRIPT_NAME = 'LMRY_CO_ST_BillCredit_WHT_Lines_LBRY_V2.0.js';

  var CONFIG_TRANSACTION = {
    'vendorcredit': {
      'recordtype': 'vendorbill',
      "form": "vendorbillform"
    }
  };
  var FEATURE_TRANSACTION = {
    'vendorbill': 'CUSTOMAPPROVALVENDORBILL',
  };

  var FEATURE_SUBSIDIARY = false;
  var FEATURE_MULTIBOOK = false;
  
  var MANDATORY_DEPARTMENT = false;
  var MANDATORY_CLASS = false;
  var MANDATORY_LOCATION = false;
  var FEATURE_APPROVAL = false;

  var MEMO_TRANSACTION = '(LatamTax -  WHT)';
  var MEMO_LINE = ' (LatamTax - WHT) ';
  var WHT_MEMO = 'Latam - WHT Tax';

  var exchangeRate = 0;
  var itemLineCount = 0;
  var expenseLineCount = 0;
  /*********************************************************************************************************
   * Funcion que realiza el calculo de los impuestos.
   * Para Peru: Llamada desde el User Event del Invoice, Credit Memo.
   ********************************************************************************************************/
  function setWHTTransaction(recordObj, scriptContext, licenses) {
    try {
      var type = scriptContext.type;
      var recordId = "";
      var transactionType = "";
      
      recordId = recordObj.id;
      transactionType = recordObj.type;
      if (type == "edit") {
        deleteRelatedRecords(recordId, transactionType);
      }

      var override = recordObj.getValue({fieldId: "taxdetailsoverride"});
      var appliedWHT = recordObj.getValue({fieldId: "custbody_lmry_apply_wht_code"});
      if (appliedWHT == true || appliedWHT == "T") {

        FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});
        FEATURE_MULTIBOOK = runtime.isFeatureInEffect({feature: "MULTIBOOK"});
        
        MANDATORY_DEPARTMENT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
        MANDATORY_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });
        MANDATORY_LOCATION = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
        
        var subsidiary;
        if (FEATURE_SUBSIDIARY) {
          subsidiary = recordObj.getValue({fieldId: "subsidiary"});
        } else {
          subsidiary = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country",});
        }
        
        var transactionDate = recordObj.getText({fieldId: "trandate"});
        var transactionDateValue = recordObj.getValue({fieldId: "trandate"});
        var idCountry = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country"});
        var transactionEntity = recordObj.getValue({fieldId: "entity"});
        var transactionDocumentType = recordObj.getValue({fieldId: 'custbody_lmry_document_type'});
        
        var filtroTransactionType;
        switch (transactionType) {
          case "vendorcredit":
            filtroTransactionType = 7;
            break;
          default:
            return recordObj;
        }
               
        var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
        exchangeRate = getExchangeRate(recordObj, subsidiary, setupSubsidiary);
        
        itemLineCount = recordObj.getLineCount({sublistId: 'item'});
        expenseLineCount = recordObj.getLineCount({ sublistId: "expense" });

        FEATURE_APPROVAL = runtime.getCurrentScript().getParameter({name: FEATURE_TRANSACTION["vendorbill"]});
        
        if (FEATURE_APPROVAL == true || FEATURE_APPROVAL == 'T') {
          
          var taxResults = [];
          var transactionArray = [];
          var journalArray = [];
          
          var CC_SearchResult = getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, transactionEntity, transactionDocumentType);
          var NT_SearchResult = getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, transactionDocumentType);
          
          calculateWHTTax(recordObj, taxResults, CC_SearchResult, NT_SearchResult, transactionArray, journalArray, licenses);
          
          // log.error("taxResults", taxResults);
          // log.error("transactionArray", transactionArray);
          // log.error("journalArray", journalArray);
          
          var reteIVA = 0;
          var reteICA = 0;
          var reteFTE = 0;
          var reteCREE = 0;
          
          for (var whtdetail in transactionArray) {
            switch (transactionArray[whtdetail].subtype.value) {
              case "18":
                reteIVA += transactionArray[whtdetail].whtamount;
                break;
              case "19":
                reteICA += transactionArray[whtdetail].whtamount;
                break;
              case "20":
                reteCREE += transactionArray[whtdetail].whtamount;
                break;
              case "21":
                reteFTE += transactionArray[whtdetail].whtamount;
                break;
            }
          }

          for (var whtdetail in journalArray) {
            switch (journalArray[whtdetail].subtype.value) {
              case "82":
                reteIVA += journalArray[whtdetail].whtamount;
                break;
              case "83":
                reteICA += journalArray[whtdetail].whtamount;
                break;
              case "84":
                reteCREE += journalArray[whtdetail].whtamount;
                break;
              case "85":
                reteFTE += journalArray[whtdetail].whtamount;
                break;
            }
          }

          record.submitFields({
            type: transactionType,
            id: recordId,
            values: {
              "custbody_lmry_co_reteiva_amount": reteIVA,
              "custbody_lmry_co_reteica_amount": reteICA,
              "custbody_lmry_co_retecree_amount": reteCREE,
              "custbody_lmry_co_retefte_amount": reteFTE
            },
            options: {
              enableSourcing: true,
              ignoreMandatoryFields: true,
              disableTriggers: true
            }
          });

          createWHTTransaction(recordObj, transactionArray, setupSubsidiary, licenses);
          createWHTJournal(recordObj, journalArray, setupSubsidiary, licenses);
          saveTaxResult(recordId, subsidiary, idCountry, transactionDateValue, taxResults);
        }
        else {
          Library_Mail.sendemail('[ setWHTTransaction]: The approval routing for the transaction is disabled. ', LMRY_SCRIPT);
          Library_Log.doLog({ title: '[ afterSubmit - setWHTTransaction ]', message: "The approval routing for the transaction is disabled.", relatedScript: LMRY_SCRIPT_NAME });
          return true;
      }
       
      } // Fin if appliedWht
      
    } catch (error) {
      // log.error("setWHTTransaction", error);
      Library_Mail.sendemail('[ afterSubmit - setWHTTransaction ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ afterSubmit - setWHTTransaction ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  
  /***************************************************************************
  * FUNCION PARA CALCULAR LOS IMPUESTOS DE TIPO "DETRACCION" 
  * SETEAR EN TAX DETAILS Y GENERAR TAX RESULT
  *    - recordObj: Registro de la transaccion
  *    - CC_SearchResult: Resultado de la busqueda de Contributory Classes
  *    - NT_SearchResult: Resultado de la busqueda de National Taxes
  *    - taxResults: Json donde se acumulará los Tax Result
  ***************************************************************************/
  function calculateWHTTax(recordObj, whtResult, CC_SearchResult, NT_SearchResult, transactionArray, journalArray, licenses) {
    try {
      if (CC_SearchResult != null && CC_SearchResult.length > 0) {
        for (var i = 0; i < CC_SearchResult.length; i++) {
  
          var CC_internalID = CC_SearchResult[i].getValue({ name: "internalid" });
          var CC_taxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_co_ccl_taxrate" });
          var CC_generatedTransaction = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_gen_transaction" });
          var CC_generatedTransactionID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_gen_transaction" });
          var CC_taxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_taxtype" });
          var CC_taxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_taxtype" });
          var CC_subTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
          var CC_subType = CC_SearchResult[i].getText({ name: "custrecord_lmry_sub_type" });
          var CC_Department = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_department" });
          var CC_DepartmentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_department" });
          var CC_Class = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_class" });
          var CC_ClassID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_class" });
          var CC_Location = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_location" });
          var CC_LocationID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_location" });
          var CC_debitAccount = CC_SearchResult[i].getText({ name: "custrecord_lmry_br_ccl_account1" });
          var CC_debitAccountID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_ccl_account1" });
          var CC_creditAccount = CC_SearchResult[i].getText({ name: "custrecord_lmry_br_ccl_account2" });
          var CC_creditAccountID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_br_ccl_account2" });
          var CC_taxItem = CC_SearchResult[i].getValue({name: "custrecord_lmry_ar_ccl_taxitem"});
          var CC_taxCode = CC_SearchResult[i].getValue({name: "custrecord_lmry_ar_ccl_taxcode"});
          var CC_amountTo = CC_SearchResult[i].getValue('custrecord_lmry_amount');
          var CC_appliesTo= CC_SearchResult[i].getValue("custrecord_lmry_ccl_appliesto");
          var CC_whtDescription = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_description" });
  
          var CC_appliesToItem = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_applies_to_item" });
          var CC_appliesToAccount = CC_SearchResult[i].getValue({name: "custrecord_lmry_ccl_applies_to_account"});
  
          if (itemLineCount != null && itemLineCount > 0) {
  
            for (var j = 0; j < itemLineCount; j++) {
  
              var item = recordObj.getSublistText({ sublistId: "item", fieldId: "item", line: j });
              var itemID = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: j });
              var itemUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: j });
              var itemApplyWht = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_apply_wht_tax", line: j});
  
              if (itemID != CC_appliesToItem) {
                continue;
              }
              if (!itemApplyWht) {
                continue;
              }
              var baseAmount = 0;
              switch (CC_amountTo) {
                case "1":
                  baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "grossamt", line: j });
                  break;
                case "2":
                  baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxamount", line: j });
                  break;
                case "3":
                  baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j });
                  break;
              }
  
              var WHTAmount = parseFloat(baseAmount) * parseFloat(CC_taxRate) / 100;
  
              whtResult.push({
                taxtype: {
                  text: CC_taxType,
                  value: CC_taxTypeID
                },
                subtype: {
                  text: CC_subType,
                  value: CC_subTypeID
                },
                lineUniqueKey: itemUniqueKey,
                baseamount: parseFloat(baseAmount),
                whtamount: Math.round(WHTAmount * 100) / 100,
                whtrate: CC_taxRate + "%",
                contributoryClass: CC_internalID,
                nationalTax: "",
                debitaccount: {
                  text: CC_debitAccount,
                  value: CC_debitAccountID
                },
                creditaccount: {
                  text: CC_creditAccount,
                  value: CC_creditAccountID
                },
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
                description: CC_whtDescription,
                lc_baseamount: parseFloat(baseAmount * exchangeRate),
                lc_whtamount: parseFloat(WHTAmount * exchangeRate)
              });
              // log.error("whtResult", whtResult)
  
              if ( CC_generatedTransactionID == "5" ) {
                var auxTransJson = {
                  contributoryClass: CC_internalID,
                  nationalTax: "",
                    subtype: {
                        text: CC_subType,
                        value: CC_subTypeID
                    },
                    taxitem: CC_taxItem,
                    taxcode: CC_taxCode,
                    appliestoitem: CC_appliesToItem,
                    department: CC_DepartmentID,
                    class: CC_ClassID,
                    location: CC_LocationID,
                    whtamount: Math.round(WHTAmount * 100) / 100,
                    description: CC_whtDescription
                };
                transactionArray.push(auxTransJson);
  
              } else if (CC_generatedTransactionID == "1") {
                var auxJounarlJson = {
                  contributoryClass: CC_internalID,
                  nationalTax: "",
                  subtype: {
                      text: CC_subType,
                      value: CC_subTypeID
                  },
                  debitaccount: CC_debitAccountID,
                  creditaccount: CC_creditAccountID,
                  appliestoitem: CC_appliesToItem,
                  department: CC_DepartmentID,
                  class: CC_ClassID,
                  location: CC_LocationID,
                  whtamount: Math.round(WHTAmount * 100) / 100,
                  description: CC_whtDescription
                };
  
                journalArray.push(auxJounarlJson);
  
              }
  
            } // Fin for itemLineCount  
          } // Fin if itemLineCount
  
          if (expenseLineCount != null && expenseLineCount > 0) {
  
            for (var j = 0; j < expenseLineCount; j++) {
  
              var account = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'account', line: j });
              var accountID = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'account', line: j });
              var expenseUniqueKey = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'lineuniquekey', line: j });
              var expenseApplyWht = recordObj.getSublistValue({ sublistId: "expense", fieldId: "custcol_lmry_apply_wht_tax", line: j });
              
              if (accountID != CC_appliesToAccount) {
                continue;
              }
              
              if (!expenseApplyWht) {
                continue;
              }
  
              var baseAmount = 0;
              
              switch (CC_amountTo) {
                case "1":
                  baseAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "grossamt", line: j });
                  break;
                case "2":
                  baseAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "taxamount", line: j });
                  break;
                case "3":
                  baseAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j });
                  break;
              }
  
              var WHTAmount = parseFloat(baseAmount) * parseFloat(CC_taxRate) / 100;
  
              whtResult.push({
                taxtype: {
                  text: CC_taxType,
                  value: CC_taxTypeID
                },
                subtype: {
                  text: CC_subType,
                  value: CC_subTypeID
                },
                lineUniqueKey: expenseUniqueKey,
                baseamount: parseFloat(baseAmount),
                whtamount: Math.round(WHTAmount * 100) / 100,
                whtrate: CC_taxRate + "%",
                contributoryClass: CC_internalID,
                nationalTax: "",
                debitaccount: {
                  text: CC_debitAccount,
                  value: CC_debitAccountID
                },
                creditaccount: {
                  text: CC_creditAccount,
                  value: CC_creditAccountID
                },
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
                description: CC_whtDescription,
                lc_baseamount: parseFloat(baseAmount * exchangeRate),
                lc_whtamount: parseFloat(WHTAmount * exchangeRate)
              });
  
              if ( CC_generatedTransactionID == "5" ) {
                var auxTransJson = {
                  contributoryClass: CC_internalID,
                  nationalTax: "",
                    subtype: {
                        text: CC_subType,
                        value: CC_subTypeID
                    },
                    taxitem: CC_taxItem,
                    taxcode: CC_taxCode,
                    appliestoaccount: CC_appliesToAccount,
                    department: CC_DepartmentID,
                    class: CC_ClassID,
                    location: CC_LocationID,
                    whtamount: Math.round(WHTAmount * 100) / 100,
                    description: CC_whtDescription
                };
                transactionArray.push(auxTransJson);
  
              } else if (CC_generatedTransactionID == "1") {
                var auxJounarlJson = {
                  contributoryClass: CC_internalID,
                  nationalTax: "",
                  subtype: {
                      text: CC_subType,
                      value: CC_subTypeID
                  },
                  debitaccount: CC_debitAccountID,
                  creditaccount: CC_creditAccountID,
                  appliestoaccount: CC_appliesToAccount,
                  department: CC_DepartmentID,
                  class: CC_ClassID,
                  location: CC_LocationID,
                  whtamount: Math.round(WHTAmount * 100) / 100,
                  description: CC_whtDescription
                };
  
                journalArray.push(auxJounarlJson);
  
              }
            }
          }
        } // FIN FOR CONTRIBUTORY CLASS
      }
      if (NT_SearchResult != null && NT_SearchResult.length > 0) {
        for (var i = 0; i < NT_SearchResult.length; i++) {
          var NT_internalID = NT_SearchResult[i].getValue({ name: "internalid" });
          var NT_taxRate = NT_SearchResult[i].getValue({ name: "custrecord_lmry_co_ntax_taxrate" });
          var NT_generatedTransaction = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_gen_transaction" });
          var NT_generatedTransactionID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_gen_transaction" });
          var NT_taxType = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_taxtype" });
          var NT_taxTypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxtype" });
          var NT_subtype = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_sub_type" });
          var NT_subtypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_sub_type" });
          var NT_Department = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_department" });
          var NT_DepartmentID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_department" });
          var NT_Class = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_class" });
          var NT_ClassID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_class" });
          var NT_Location = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_location" });
          var NT_LocationID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_location" });
          var NT_taxItem = NT_SearchResult[i].getValue({name: "custrecord_lmry_ntax_taxitem"});
          var NT_taxCode = NT_SearchResult[i].getValue({name: "custrecord_lmry_ntax_taxcode"});
          var NT_amountTo = NT_SearchResult[i].getValue('custrecord_lmry_ntax_amount')
          var NT_appliesTo= NT_SearchResult[i].getValue("custrecord_lmry_ntax_appliesto");
          var NT_whtDescription = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_description" });
          var NT_debitAccount = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_debit_account" });
          var NT_debitAccountID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_debit_account" });
          var NT_creditAccount = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_credit_account" });
          var NT_creditAccountID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_credit_account" });
  
          var NT_appliesToItem = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_applies_to_item" });
          var NT_appliesToAccount = NT_SearchResult[i].getValue({name: "custrecord_lmry_ntax_applies_to_account"});
  
          if (itemLineCount != null && itemLineCount > 0) {
            for (var j = 0; j < itemLineCount; j++) {
              var item = recordObj.getSublistText({ sublistId: "item", fieldId: "item", line: j });
              var itemID = recordObj.getSublistValue({ sublistId: "item", fieldId: "item", line: j });
              var itemUniqueKey = recordObj.getSublistValue({ sublistId: "item", fieldId: "lineuniquekey", line: j });
              var itemApplyWht = recordObj.getSublistValue({ sublistId: "item", fieldId: "custcol_lmry_apply_wht_tax", line: j});
  
              if (itemID != NT_appliesToItem) {
                continue;
              }
              if (!itemApplyWht) {
                continue;
              }
  
              if (Library_Mail.getAuthorization(349, licenses) == true) {
                var avoidNT = false;
                for (var whtdetail in transactionArray) {
                  if ((transactionArray[whtdetail].subtype.value == NT_subtypeID) && (transactionArray[whtdetail].appliestoitem == NT_appliesToItem)) {
                      avoidNT = true;
                      break;
                    }
                }
                if (avoidNT) {
                  continue;
                }
  
                for (var whtdetail in journalArray) {
                  if ((journalArray[whtdetail].subtype.value == NT_subtypeID) && (journalArray[whtdetail].appliestoitem == NT_appliesToItem)) {
                    avoidNT = true;
                    break;
                  }
                }
                if (avoidNT) {
                    continue;
                }
              }

              var baseAmount = 0;
              switch (NT_amountTo) {
                case "1":
                  baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "grossamt", line: j });
                  break;
                case "2":
                  baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "taxamount", line: j });
                  break;
                case "3":
                  baseAmount = recordObj.getSublistValue({ sublistId: "item", fieldId: "amount", line: j });
                  break;
              }
  
              var WHTAmount = parseFloat(baseAmount) * parseFloat(NT_taxRate) / 100;
  
              whtResult.push({
                taxtype: {
                  text: NT_taxType,
                  value: NT_taxTypeID
                },
                subtype: {
                  text: NT_subtype,
                  value: NT_subtypeID
                },
                lineUniqueKey: itemUniqueKey,
                baseamount: parseFloat(baseAmount),
                whtamount: Math.round(WHTAmount * 100) / 100,
                whtrate: NT_taxRate + "%",
                contributoryClass: "",
                nationalTax: NT_internalID,
                debitaccount: {
                  text: NT_debitAccount,
                  value: NT_debitAccountID
                },
                creditaccount: {
                  text: NT_creditAccount,
                  value: NT_creditAccountID
                },
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
                position: j,
                description: NT_whtDescription,
                lc_baseamount: parseFloat(baseAmount * exchangeRate),
                lc_whtamount: parseFloat(WHTAmount * exchangeRate)
              });
  
              if ( NT_generatedTransactionID == "5" ) {
                var auxTransJson = {
                  contributoryClass: "",
                  nationalTax: NT_internalID,
                  subtype: {
                    text: NT_subtype,
                    value: NT_subtypeID
                  },
                  taxitem: NT_taxItem,
                  taxcode: NT_taxCode,
                  appliestoitem: NT_appliesToItem,
                  department: NT_DepartmentID,
                  class: NT_ClassID,
                  location: NT_LocationID,
                  whtamount: Math.round(WHTAmount * 100) / 100,
                  description: NT_whtDescription
                };
                transactionArray.push(auxTransJson);
              } else if (NT_generatedTransactionID == "1") {
                var auxJounarlJson = {
                  contributoryClass: "",
                  nationalTax: NT_internalID,
                  subtype: {
                      text: NT_subtype,
                      value: NT_subtypeID
                  },
                  debitaccount: NT_debitAccountID,
                  creditaccount: NT_creditAccountID,
                  appliestoitem: NT_appliesToItem,
                  department: NT_DepartmentID,
                  class: NT_ClassID,
                  location: NT_LocationID,
                  whtamount: Math.round(WHTAmount * 100) / 100,
                  description: NT_whtDescription
                };
                journalArray.push(auxJounarlJson);
              }
            } // Fin for itemLineCount  
          } // Fin if itemLineCount
  
          if (expenseLineCount != null && expenseLineCount > 0) {
  
            for (var j = 0; j < expenseLineCount; j++) {
  
              var account = recordObj.getSublistText({ sublistId: 'expense', fieldId: 'account', line: j });
              var accountID = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'account', line: j });
              var expenseUniqueKey = recordObj.getSublistValue({ sublistId: 'expense', fieldId: 'lineuniquekey', line: j });
              var expenseApplyWht = recordObj.getSublistValue({ sublistId: "expense", fieldId: "custcol_lmry_apply_wht_tax", line: j });
              
              if (accountID != NT_appliesToAccount) {
                continue;
              }
              
              if (!expenseApplyWht) {
                continue;
              }
              
              if (Library_Mail.getAuthorization(349, licenses) == true) {
                var avoidNT = false;
                for (var whtdetail in transactionArray) {
                  if ((transactionArray[whtdetail].subtype.value == NT_subtypeID) && (transactionArray[whtdetail].appliestoaccount == NT_creditAccountID)) {
                      avoidNT = true;
                      break;
                    }
                }
                if (avoidNT) {
                  continue;
                }
  
                for (var whtdetail in journalArray) {
                  if ((journalArray[whtdetail].subtype.value == NT_subtypeID) && (journalArray[whtdetail].appliestoaccount == NT_creditAccountID)) {
                    avoidNT = true;
                    break;
                  }
                }
                if (avoidNT) {
                    continue;
                }
              }

              var baseAmount = 0;
              
              switch (NT_amountTo) {
                case "1":
                  baseAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "grossamt", line: j });
                  break;
                case "2":
                  baseAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "taxamount", line: j });
                  break;
                case "3":
                  baseAmount = recordObj.getSublistValue({ sublistId: "expense", fieldId: "amount", line: j });
                  break;
              }
  
              var WHTAmount = parseFloat(baseAmount) * parseFloat(NT_taxRate) / 100;
  
              whtResult.push({
                taxtype: {
                  text: NT_taxType,
                  value: NT_taxTypeID
                },
                subtype: {
                  text: NT_subtype,
                  value: NT_subtypeID
                },
                lineUniqueKey: itemUniqueKey,
                baseamount: parseFloat(baseAmount),
                whtamount: Math.round(WHTAmount * 100) / 100,
                whtrate: NT_taxRate + "%",
                contributoryClass: "",
                nationalTax: NT_internalID,
                debitaccount: {
                  text: NT_debitAccount,
                  value: NT_debitAccountID
                },
                creditaccount: {
                  text: NT_creditAccount,
                  value: NT_creditAccountID
                },
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
                position: j,
                description: NT_whtDescription,
                lc_baseamount: parseFloat(baseAmount * exchangeRate),
                lc_whtamount: parseFloat(WHTAmount * exchangeRate)
              });
  
              if ( NT_generatedTransactionID == "5" ) {
                var auxTransJson = {
                  contributoryClass: "",
                  nationalTax: NT_internalID,
                  subtype: {
                      text: NT_subtype,
                      value: NT_subtypeID
                  },
                  taxitem: NT_taxItem,
                  taxcode: NT_taxCode,
                  appliestoaccount: NT_appliesToAccount,
                  department: NT_DepartmentID,
                  class: NT_ClassID,
                  location: NT_LocationID,
                  whtamount: Math.round(WHTAmount * 100) / 100,
                  description: NT_whtDescription
                };
                transactionArray.push(auxTransJson);
  
              } else if (NT_generatedTransactionID == "1") {
                var auxJounarlJson = {
                  contributoryClass: "",
                  nationalTax: NT_internalID,
                  subtype: {
                      text: NT_subtype,
                      value: NT_subtypeID
                  },
                  debitaccount: NT_debitAccountID,
                  creditaccount: NT_creditAccountID,
                  appliestoaccount: NT_appliesToAccount,
                  department: NT_DepartmentID,
                  class: NT_ClassID,
                  location: NT_LocationID,
                  whtamount: Math.round(WHTAmount * 100) / 100,
                  description: NT_whtDescription
                };
                journalArray.push(auxJounarlJson);
              }
            }
          }
        } // FIN FOR NATIONAL TAX
      }
    } 
    catch (error) {
      // log.error("Error calculateWHTTax", error);
      Library_Mail.sendemail( "[ calculateWHTTax ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ calculateWHTTax ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /******************************************************************************
  * FUNCION PARA GENERAR UN CREDIT MEMO SI HAY DETRACCIONES APLCIADOS AL INVOICE
  *    - recordObj: Registro de la transaccion
  *    - transactionArray: Detalle de las reteciones
  *    - STS_Json: Json con data del record LatamReady - Setup Tax Subsidiary
  *    - licenses: Licencias
  *    - flagCC: Booleano para saber si se encontró CC
  ******************************************************************************/
  function createWHTTransaction(recordObj, transactionArray, STS_Json, licenses) {
    try {
      var recordType = recordObj.getValue('baserecordtype');
      var idTransaction = recordObj.id;
      var idNewRecord = null;
      var newRecordArray = [];

      if (CONFIG_TRANSACTION[recordType]) {
        var entity = recordObj.getValue('entity');
        var subsidiary = recordObj.getValue("subsidiary");
        var date = recordObj.getValue('trandate');
        date = format.parse({value: date,type: format.Type.DATE});
        var postingperiod = recordObj.getValue('postingperiod');
        var transactionDeparment = recordObj.getValue('department');
        var transactionClass = recordObj.getValue('class');
        var transactionLocation = recordObj.getValue('location');
        var transactionEntityTaxRegNumer = recordObj.getValue("entitytaxregnum");
        var account = recordObj.getValue('account');
        var exchangeRate = recordObj.getValue('exchangerate');
        var currency = recordObj.getValue('currency');
        var transactionNexusOverride = recordObj.getValue("taxregoverride");

        var toType = CONFIG_TRANSACTION[recordType]['recordtype'];

        var useGroupFeature = false;
        if (licenses) {
          useGroupFeature = Library_Mail.getAuthorization(376, licenses);
        }
        if (useGroupFeature) {
          var groupsInformationWht = transactionArray.reduce(function(rv, x) {
            rv[x["subtype"]["value"]] = rv[x["subtype"]["value"]] || [];
            rv[x["subtype"]["value"]].push(x);
            return rv;
          }, {});
        }
        else {
          var groupsInformationWht = [];
          for (var i in transactionArray) {
            var auxArray = [];
            auxArray.push(transactionArray[i]);
            groupsInformationWht.push( auxArray );
          }
        }
        for (var subtypeID in groupsInformationWht) {
          var groupWht = groupsInformationWht[subtypeID];

          var newRecordObj = record.create({
            type: toType,
            isDynamic: true
          });

          newRecordObj.setValue("entity", entity);
          newRecordObj.setValue("subsidiary", subsidiary);
          newRecordObj.setValue('trandate', date);
          newRecordObj.setValue('postingperiod', postingperiod);
          newRecordObj.setValue('memo', "Latam - STE CO WHT " + groupWht[0]["subtype"]["text"] + " (Lines)");
          newRecordObj.setValue('account', account);
          newRecordObj.setValue('exchangerate', exchangeRate);
          newRecordObj.setValue('currency', currency);
          newRecordObj.setValue('custbody_lmry_reference_transaction', idTransaction);
          newRecordObj.setValue('custbody_lmry_reference_transaction_id', idTransaction);
          newRecordObj.setValue('custbody_lmry_reference_entity', entity);
          newRecordObj.setValue("entitytaxregnum", transactionEntityTaxRegNumer);
          newRecordObj.setValue("taxdetailsoverride", true);
          newRecordObj.setValue("approvalstatus", 2 );

          if (transactionNexusOverride == true || transactionNexusOverride == "T") {
            var transactionNexus = recordObj.getValue("nexus");
            newRecordObj.setValue("nexus", transactionNexus);
          }

          //   if (FEATURE_TRANSACTION[toType]) {
          //     var approvalFeature = runtime.getCurrentScript().getParameter({
          //       name: FEATURE_TRANSACTION[toType]
          //     });
          //     if (approvalFeature == true || approvalFeature == 'T') {
          //       newRecordObj.setValue('approvalstatus', 2);
          //     }
          //   }
  
          for (var i in groupWht) {
            var informationWHT = groupWht[i];
            
            var taxItem = informationWHT["taxitem"];
            var taxCode = informationWHT["taxcode"];
            
            var taxType = search.lookupFields({type: 'salestaxitem', id: taxCode, columns: ["taxtype"]});
            taxType = taxType.taxtype[0].value;
            
            var newDeparment = "";
            var newClass = "";
            var newLocation = "";
            if (useGroupFeature) {
              newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
              newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
              newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;
            } else {
              if (STS_Json.depclassloc == true || STS_Json.depclassloc == "T") {
                newDeparment = informationWHT["department"];
                newClass = informationWHT["class"];
                newLocation = informationWHT["location"];
              } else {
                newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
                newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
                newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;
              }
            }

            newRecordObj.insertLine({sublistId: 'item',line: i});

            newRecordObj.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value: taxItem});
            newRecordObj.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: informationWHT["whtamount"]});
            newRecordObj.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: informationWHT["whtamount"]});
            newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "department", value: newDeparment });
            newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "class", value: newClass });
            newRecordObj.setCurrentSublistValue({ sublistId: "item", fieldId: "location", value: newLocation });
            
            var description = informationWHT['subtype']["text"] + MEMO_LINE;
            newRecordObj.setCurrentSublistValue({sublistId: 'item', fieldId: 'description', value: description});
            
            newRecordObj.commitLine({ sublistId: "item" });
          }
          
          var newItemLine = 0;
          for (var i in groupWht) {
            var informationWHT = groupWht[i];
            var itemDetailReference = newRecordObj.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: newItemLine });
            
            // Tax Details
            newRecordObj.selectNewLine({ sublistId: "taxdetails" });
            newRecordObj.setCurrentSublistValue("taxdetails", "taxdetailsreference", itemDetailReference);
            newRecordObj.setCurrentSublistValue("taxdetails", "taxtype", taxType);
            newRecordObj.setCurrentSublistValue("taxdetails", "taxcode", taxCode);
            newRecordObj.setCurrentSublistValue("taxdetails", "taxbasis", informationWHT["whtamount"]);
            newRecordObj.setCurrentSublistValue("taxdetails", "taxrate", 0);
            newRecordObj.setCurrentSublistValue("taxdetails", "taxamount", 0);
            newRecordObj.commitLine({ sublistId: "taxdetails" });

            newItemLine += 1;
          }
          
          var numApply = newRecordObj.getLineCount({sublistId: 'apply'});
          var totalAmount = newRecordObj.getValue({ fieldId: "total" });

          for (var j = 0; j < numApply; j++) {
            newRecordObj.selectLine({ sublistId: "apply", line: j });
            var applyTransactionID = newRecordObj.getSublistValue({ sublistId: 'apply', fieldId: 'internalid', line: j});
            
            if (Number(applyTransactionID) == Number(idTransaction)) {
              newRecordObj.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true});
              newRecordObj.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: totalAmount});
              break;
            }
          }
          
          idNewRecord = newRecordObj.save({
            ignoreMandatoryFields: true,
            disableTriggers: true,
            enableSourcing: true
          });
          // log.error("Vendor Credit", idNewRecord);
          newRecordArray.push(Number(idNewRecord));

          applyTransaction (newRecordArray, recordObj);
        }
      } 
    }
    catch (error){
      // log.error("Error createWHTTransaction", error);
      Library_Mail.sendemail('[ createWHTTransaction ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ createWHTTransaction ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
   * Aplicar las notas de creditar a la transaccion
   *    - newRecordArray: Ids de la transacciones creadas
   *    - recordObj: Registro del record base
   ***************************************************************************/
  function applyTransaction (newRecordArray, recordObj) {
    try {
      var newRecordObj = record.load({
        type: recordObj.type,
        id: recordObj.id
      });
      var applyLineCount = newRecordObj.getLineCount({ sublistId: "apply" });
      var totalAmount = newRecordObj.getValue({ fieldId: "total" });
      // log.error("totalAmount", totalAmount);
      for (var i = 0; i < applyLineCount; i++) { 
        var applyTransactionID = newRecordObj.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
        if (newRecordArray.indexOf(Number(applyTransactionID)) != -1) {
          newRecordObj.setSublistValue({ sublistId: "apply", fieldId: "apply", line: i, value: true });
          newRecordObj.setSublistValue({ sublistId: "apply", fieldId: "amount", line: i, value: totalAmount });
        }
      }
      newRecordObj.save({
        ignoreMandatoryFields: true,
        disableTriggers: true,
        enableSourcing: true
      });
    } catch (e) {
      // log.error("applyTransaction", e);
      Library_Mail.sendemail('[ applyTransaction ]: ' + e, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ applyTransaction ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }

  }

  /***************************************************************************
  * GUARDAR UN REGISTRO EN EL RECORD: Transaction
  *    - recordObj: Record cargado del cual saldrá la data
  *    - transactionID: ID de la transaccion
  *    - journalArray: Detalle de las reteciones por tipo
  *    - STS_Json: Json con data del record LatamReady - Setup Tax Subsidiary
  *    - exchageRate: Tipo de cambio
  ***************************************************************************/
  function createWHTJournal (recordObj, journalArray, STS_Json, licenses) {
    try {
      var transactionForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_journal_entry" });
      var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
      var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
      var transactionDate = recordObj.getValue({ fieldId: "trandate" });
      var transactionPeriod = recordObj.getValue({ fieldId: "postingperiod" });
      var transactionEntity = recordObj.getValue({ fieldId: "entity" });
      var transactionDeparment = recordObj.getValue({ fieldId: "department" });
      var transactionClass = recordObj.getValue({ fieldId: "class" });
      var transactionLocation = recordObj.getValue({ fieldId: "location" });
      
      var transactionID = recordObj.id;
      
      var useGroupFeature = false;
      if (licenses) {
        useGroupFeature = Library_Mail.getAuthorization(376, licenses);
      }

      if (useGroupFeature) {
        var groupsInformationWht = journalArray.reduce(function(rv, x) {
         rv[x["subtype"]["value"]] = rv[x["subtype"]["value"]] || [];
         rv[x["subtype"]["value"]].push(x);
         return rv;
        }, {});
      }
      else {
        var groupsInformationWht = [];
          for (var i in journalArray) {
            var auxArray = [];
            auxArray.push(journalArray[i]);
            groupsInformationWht.push( auxArray );
          }
      }
      
      for (var subtypeID in groupsInformationWht) {
        var groupWht = groupsInformationWht[subtypeID];

        var newRecordObj = record.create({
          type: record.Type.JOURNAL_ENTRY,
          isDynamic: true
        });

        newRecordObj.setValue({ fieldId: "customform", value: transactionForm });
        newRecordObj.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });
        newRecordObj.setValue({ fieldId: "currency", value: transactionCurrency });
        newRecordObj.setValue({ fieldId: "exchangerate", value: exchangeRate });
        newRecordObj.setValue({ fieldId: "trandate", value: transactionDate });
        newRecordObj.setValue({ fieldId: "memo", value: "Latam - STE CO WHT " + groupWht[0]["subtype"]["text"] + " (Lines)" });
        newRecordObj.setValue({ fieldId: "postingperiod", value: transactionPeriod });

        newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
        newRecordObj.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });
        newRecordObj.setValue({ fieldId: "custbody_lmry_reference_entity", value: transactionEntity });
        newRecordObj.setValue({ fieldId: "approvalstatus", value: 2 });

        for (var j in groupWht) {
          var whtDetailJson = groupWht[j];

          var newDeparment = "";
          var newClass = "";
          var newLocation = "";
          if (useGroupFeature) {
            newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
            newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
            newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;
          } else {
            if (STS_Json.depclassloc == true || STS_Json.depclassloc == "T") {
              newDeparment = groupWht[j].department;
              newClass = groupWht[j].class;
              newLocation = groupWht[j].location;
            } else {
              newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
              newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
              newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;
            }
          }
          
          newRecordObj.selectNewLine({ sublistId: "line" });
          if (recordObj.type == "vendorbill") {
            newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: whtDetailJson.debitaccount });
          } else if (recordObj.type == "vendorcredit") {
            newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: whtDetailJson.creditaccount });
          }
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "debit", value: whtDetailJson.whtamount });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: whtDetailJson.description });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: newDeparment });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: newClass });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: newLocation });
          newRecordObj.commitLine({ sublistId: "line" });

          newRecordObj.selectNewLine({ sublistId: "line" });
          if (recordObj.type == "vendorbill") {
            newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: whtDetailJson.creditaccount });
          } else if (recordObj.type == "vendorcredit") {
            newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: whtDetailJson.debitaccount });
          }
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "credit", value: whtDetailJson.whtamount });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: whtDetailJson.description });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "department", value: newDeparment });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: newClass });
          newRecordObj.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: newLocation });
          newRecordObj.commitLine({ sublistId: "line" });
        }

        var newTransactionID = newRecordObj.save({
          ignoreMandatoryFields: true,
          disableTriggers: true,
          enableSourcing: true
        });
        // log.error("journal", newTransactionID);
      }
     } catch (e) {
        // log.error("createWHTJournal", e)
        Library_Mail.sendemail('[ createWhtJournal ]: ' + e, LMRY_SCRIPT);
        Library_Log.doLog({ title: '[ createWhtJournal ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
     }
  }

  /***************************************************************************
   * Funcion que elimina los Journal y Registros del record
   * LatamReady - LatamTax Tax Results" en caso se elimine la transacción
   * llamada desde el User Event del Invoice, Credit Memo, Bill y Bill Credit
   *    - transactionID: ID de la transaccion
   *    - transactionType: Tipo de transaccion
   ***************************************************************************/
  function deleteRelatedRecords(transactionID, transactionType) {
    try {
      // BUSQUEDA DE TRANSACCIONES RELACIONADAS
      var relatedIDs = [];
      var Transaction_Search = search.create({
        type: "vendorbill",
        columns: ["internalid"],
        filters: [
          ["custbody_lmry_reference_transaction", "IS", transactionID], 
          "AND",
          ["mainline", "IS", "T"]
        ]
      });
      var Transaction_SearchResult = Transaction_Search.run().getRange(0, 1000);
      if (Transaction_SearchResult != null && Transaction_SearchResult.length > 0) {
        for (var i = 0; i < Transaction_SearchResult.length; i++) {
          relatedIDs.push(Number(Transaction_SearchResult[i].getValue("internalid")));
        }
      }
      

      if (relatedIDs.length > 0) {

        var recordObj = record.load({
            type: "vendorcredit",
            id: transactionID
        });

        var applyLineCount = recordObj.getLineCount({ sublistId: "apply" });
        for (var i = 0; i < applyLineCount; i++) {
            var applyTransactionID = recordObj.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
            if (relatedIDs.indexOf(Number(applyTransactionID)) != -1) {
                recordObj.setSublistValue({ sublistId: "apply", fieldId: "apply", line: i, value: false });
            }
        }

        recordObj.save({
            enableSourcing: true,
            ignoreMandatoryFields: true,
            disableTriggers: true
        });
      }
      
      for (var i = 0; i < relatedIDs.length; i++) {
        record.delete({
          type: search.Type.VENDOR_BILL,
          id: relatedIDs[i]
        });
      }

      // BUSQUEDA DE JOURNALA ENTRY RELACIONADOS
      var JE_Search = search.create({
        type: search.Type.JOURNAL_ENTRY,
        columns: ["internalid"],
        filters: [
          ["custbody_lmry_reference_transaction", "IS", transactionID]
        ]
      });
      var JE_SearchResult = JE_Search.run().getRange(0, 1000);
      var auxID = 0;
      if (JE_SearchResult != null && JE_SearchResult.length != 0) {
        for (var i = 0; i < JE_SearchResult.length; i++) {
          var JE_ID = JE_SearchResult[i].getValue("internalid");
          if (auxID != JE_ID) {
            auxID = JE_ID;
            record.delete({
              type: record.Type.JOURNAL_ENTRY,
              id: JE_ID
            });
          }
        }
      }
    } catch (e) {
      // log.error("deleteRelatedRecords", e);
      Library_Mail.sendemail('[ deleteRelatedRecords ]' + e, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ deleteRelatedRecords ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /*******************************************************************************
  * FUNCION PARA SETEAR EN EL TAX DETAIL DEL CREDIT MEMO GENERADO
  *    - tranObj: Registro de la transaccion
  *    - WHTtranId: ID del Credit Memo generado
  *    - taxResults_array: Json donde se acumuló los Tax Result de tipo Detraccion
  *    - taxCode: Tax Code
  *    - taxType: Tax Type
  *******************************************************************************/
  function setTaxDetailWHTTransaction(tranObj, WHTTranId, taxResults_array, taxCode, taxType) {
    try {
      var recordType = tranObj.getValue('baserecordtype');
      var toType = CONFIG_TRANSACTION[recordType]['recordtype'];

      var recordObj = record.load({
        type: toType,
        id: WHTTranId,
        isDynamic: false
      });

      // Tax Details fields del Invoice
      var nexus = tranObj.getValue({ fieldId: 'nexus' });
      var nexusOverRide = tranObj.getValue({ fieldId: 'taxregoverride' });
      var transactionType = tranObj.getValue({ fieldId: 'custbody_ste_transaction_type' });
      var subTaxRegNumber = tranObj.getValue({ fieldId: 'subsidiarytaxregnum' });
      var entityTaxRegNumber = tranObj.getValue({ fieldId: 'entitytaxregnum' });

      // Tax Details fields del Credit MEMO_LINE
      recordObj.setValue({ fieldId: 'nexus', value: nexus });
      recordObj.setValue({ fieldId: 'taxregoverride', value: nexusOverRide });
      recordObj.setValue({ fieldId: 'custbody_ste_transaction_type', value: transactionType });
      recordObj.setValue({ fieldId: 'subsidiarytaxregnum', value: subTaxRegNumber });
      recordObj.setValue({ fieldId: 'entitytaxregnum', value: entityTaxRegNumber });

      var lineCount = recordObj.getLineCount({sublistId: 'item'});

      for (var i = 0; i < lineCount; i++) {
        var itemDetailsReference = recordObj.getSublistValue({sublistId: 'item',fieldId: 'taxdetailsreference',line: i});
  
        recordObj.insertLine({sublistId: 'taxdetails',line: i});
  
        recordObj.setSublistValue({sublistId: 'taxdetails',fieldId: 'taxdetailsreference',line: i,value: itemDetailsReference});
        recordObj.setSublistValue({sublistId: 'taxdetails',fieldId: 'taxtype',line: i,value: taxType});
        recordObj.setSublistValue({sublistId: 'taxdetails',fieldId: 'taxcode',line: i,value: taxCode});
        recordObj.setSublistValue({sublistId: 'taxdetails',fieldId: 'taxbasis',line: i,value: taxResults_array[i]['baseamount']});
        recordObj.setSublistValue({sublistId: 'taxdetails',fieldId: 'taxrate',line: i,value: parseFloat(parseFloat(taxResults_array[i]['whtrate']) * 100)});
        recordObj.setSublistValue({sublistId: 'taxdetails',fieldId: 'taxamount',line: i,value: 0.00});
      }
      
      var recordId = recordObj.save({
        ignoreMandatoryFields: true,
        disableTriggers: true,
        enableSourcing: true
      });

      return recordId;

    } catch (error) {
      Library_Mail.sendemail('[ setTaxDetailCreditMemo ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ setTaxDetailCreditMemo ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * GUARDAR TAX RESULT EN EL RECORD: LATAMREADY - LATAMTAX TAX RESULT
  *    - transaction: ID de la Transaccion
  *    - subsidiary: Subsidiaria
  *    - country: Pais
  *    - TResultTax: Tax Results de Calculo de Impuestos
  *    - TResultWth: Tax Results de Retenciones, Detracciones o Percepciones
  ***************************************************************************/
  function saveTaxResult(transaction, subsidiary, country, transactionDate, TResultWth) {
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

  /***************************************************************************
    * BUSQUEDA DEL RECORD: LATMAREADY - CONTRIBUTORY CLASS
    *    - subsidiary: Subsiaria
    *    - transactionDate: Fecha de creación de la transacción
    *    - filtroTransactionType: Invoice / Credit Memo
    *    - entity: ID de la Entidad
    *    - documentType: Tipo de Documento Fiscal
    ***************************************************************************/
  function getContributoryClasses ( subsidiary, transactionDate, filtroTransactionType, entity, documentType ) {
    try {
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
        ["custrecord_lmry_ccl_taxtype", "anyof", "1"], //1:Retencion, 2:Percepcion, 3:Detraccion, 4:Calculo de Impuesto
        "AND",
        ["custrecord_lmry_ccl_gen_transaction", "anyof", ["5", "1"]], //1:Journal, 2:SuiteGL, 3:LatamTax(Purchase), 4:Add Line, 5: Wht by Trans, 6: LatamTax (Sales)
        "AND",
        ["custrecord_lmry_ccl_appliesto", "anyof", ["2"]] // Lineas
      ];
  
      var documents = ["@NONE@"];
      if (documentType) {
        documents.push(documentType);
      }
      filtrosCC.push("AND", ["custrecord_lmry_ccl_fiscal_doctype", "anyof", documents]);
  
      if (FEATURE_SUBSIDIARY) {
        filtrosCC.push("AND", ["custrecord_lmry_ar_ccl_subsidiary", "anyof", subsidiary]);
      }
  
      var searchCC = search.create({
        type: "customrecord_lmry_ar_contrib_class",
        columns: [
          "internalid",
          "custrecord_lmry_co_ccl_taxrate",
          "custrecord_lmry_ccl_taxtype",
          "custrecord_lmry_sub_type",
          "custrecord_lmry_br_ccl_account1",
          "custrecord_lmry_br_ccl_account2",
          "custrecord_lmry_ccl_gen_transaction",
          "custrecord_lmry_ar_ccl_department",
          "custrecord_lmry_ar_ccl_class",
          "custrecord_lmry_ar_ccl_location",
          "custrecord_lmry_amount",
          "custrecord_lmry_ar_ccl_taxitem",
          "custrecord_lmry_ar_ccl_taxcode",
          "custrecord_lmry_ccl_appliesto",
          "custrecord_lmry_ccl_applies_to_item",
          "custrecord_lmry_ccl_applies_to_account",
          "custrecord_lmry_ccl_description"
        ],
        filters: filtrosCC,
      });
  
      var searchResultCC = searchCC.run().getRange({start: 0,end: 1000});
      return searchResultCC;
    }
    catch(error) {
      Library_Mail.sendemail('[ getContributoryClasses ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ getContributoryClasses ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
    * BUSQUEDA DEL RECORD: LATMAREADY - NATIONAL TAX
    *    - subsidiary: Subsiaria
    *    - transactionDate: Fecha de creación de la transacción
    *    - filtroTransactionType: Invoice / Credit Memo
    *    - documentType: Tipo de Documento Fiscal
    ***************************************************************************/
  function getNationalTaxes ( subsidiary, transactionDate, filtroTransactionType, documentType ) {
    try {
      var filtrosNT = [
        ["isinactive", "is", "F"],
        "AND",
        ["custrecord_lmry_ntax_datefrom", "onorbefore", transactionDate],
        "AND",
        ["custrecord_lmry_ntax_dateto", "onorafter", transactionDate],
        "AND",
        ["custrecord_lmry_ntax_transactiontypes", "anyof", filtroTransactionType],
        "AND",
        ["custrecord_lmry_ntax_taxtype", "anyof", "1"],
        "AND",
        ["custrecord_lmry_ntax_gen_transaction", "anyof", ["5", "1"]],
        "AND",
        ["custrecord_lmry_ntax_appliesto", "anyof", ["2"]] // Lineas
      ];
  
      var documents = ["@NONE@"];
      if (documentType) {
        documents.push(documentType);
      }
      filtrosNT.push("AND", ["custrecord_lmry_ntax_fiscal_doctype", "anyof", documents]);
  
      if (FEATURE_SUBSIDIARY) {
        filtrosNT.push("AND", ["custrecord_lmry_ntax_subsidiary", "anyof", subsidiary]);
      }
  
      var searchNT = search.create({
        type: "customrecord_lmry_national_taxes",
        columns: [
          "internalid",
          "custrecord_lmry_ntax_taxtype",
          "custrecord_lmry_co_ntax_taxrate",
          "custrecord_lmry_ntax_sub_type",
          "custrecord_lmry_ntax_debit_account",
          "custrecord_lmry_ntax_credit_account",
          "custrecord_lmry_ntax_gen_transaction",
          "custrecord_lmry_ntax_department",
          "custrecord_lmry_ntax_class",
          "custrecord_lmry_ntax_location",
          "custrecord_lmry_ntax_taxitem",
          "custrecord_lmry_ntax_taxcode",
          "custrecord_lmry_ntax_appliesto",
          "custrecord_lmry_ntax_amount",
          "custrecord_lmry_ntax_applies_to_account",
          "custrecord_lmry_ntax_applies_to_item",
          "custrecord_lmry_ntax_description"
        ],
        filters: filtrosNT,
      });
      var searchResultNT = searchNT.run().getRange({
        start: 0,
        end: 1000,
      });
      return searchResultNT;
    }
    catch(error) {
      Library_Mail.sendemail('[ getNationalTaxes ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ getNationalTaxes ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * FUNCION PARA OBTENER EL TIPO DE CAMBIO CON EL QUE SE VAN A REALIZAR LOS
  * CALCULOS DE IMPUESTOS
  *    - recordObj: Registro de la transaccion
  *    - subsidiary: Subsidiaria de transaccion
  *    - setupSubsidiary: Json con campos del record LatamReady - Setup Tax Subsidiary
  ***************************************************************************/
  function getExchangeRate(recordObj, subsidiary, setupSubsidiary) {
    try {
      var exchangeRate = 1;

      if (FEATURE_SUBSIDIARY && FEATURE_MULTIBOOK) {
        // OneWorld y Multibook
        var currencySubs = search.lookupFields({
          type: "subsidiary",
          id: subsidiary,
          columns: ["currency"]
        });
        currencySubs = currencySubs.currency[0].value;

        if (currencySubs != setupSubsidiary["currency"] && setupSubsidiary["currency"] != "" && setupSubsidiary["currency"] != null) {
          var lineasBook = recordObj.getLineCount({
            sublistId: "accountingbookdetail",
          });
          if (lineasBook != null && lineasBook != "") {
            for (var i = 0; i < lineasBook; i++) {
              var lineaCurrencyMB = recordObj.getSublistValue({
                sublistId: "accountingbookdetail",
                fieldId: "currency",
                line: i,
              });
              if (lineaCurrencyMB == currencySetup) {
                exchangeRate = recordObj.getSublistValue({
                  sublistId: "accountingbookdetail",
                  fieldId: "exchangerate",
                  line: i,
                });
                break;
              }
            }
          }
        } else {
          // La moneda de la subsidiaria es igual a la moneda del setup
          exchangeRate = recordObj.getValue({fieldId: "exchangerate",});
        }
      } else {
        // No es OneWorld o no tiene Multibook
        exchangeRate = recordObj.getValue({fieldId: "exchangerate",});
      }
      exchangeRate = parseFloat(exchangeRate);
      return exchangeRate;
    } catch (error) {
      Library_Mail.sendemail( "[ getExchangeRate ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ getExchangeRate ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * BUSQUEDA DEL RECORD: LATMAREADY - SETUP TAX SUBSIDIARY
  *    - subsidiary: Subsiaria a filtrar para recuperar su configuración
  ***************************************************************************/
  function getSetupTaxSubsidiary(subsidiary) {
    try {
      var filters = [["isinactive", "is", "F"], "AND"];
      if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
        filters.push([
          "custrecord_lmry_setuptax_subsidiary",
          "anyof",
          subsidiary,
        ]);
      }

      var search_setupSub = search.create({
        type: "customrecord_lmry_setup_tax_subsidiary",
        filters: filters,
        columns: [
          "custrecord_lmry_setuptax_subsidiary",
          "custrecord_lmry_setuptax_currency",
          "custrecord_lmry_setuptax_depclassloc",
          "custrecord_lmry_setuptax_type_rounding",
          "custrecord_lmry_setuptax_department",
          "custrecord_lmry_setuptax_class",
          "custrecord_lmry_setuptax_location"
        ],
      });

      var results = search_setupSub.run().getRange(0, 1);

      var setupSubsidiary = {};

      if (results && results.length > 0) {
        setupSubsidiary["depclassloc"] = results[0].getValue(
          "custrecord_lmry_setuptax_depclassloc"
        );
        setupSubsidiary["rounding"] = results[0].getValue(
          "custrecord_lmry_setuptax_type_rounding"
        );
        setupSubsidiary["department"] = results[0].getValue(
          "custrecord_lmry_setuptax_department"
        );
        setupSubsidiary["class"] = results[0].getValue(
          "custrecord_lmry_setuptax_class"
        );
        setupSubsidiary["location"] = results[0].getValue(
          "custrecord_lmry_setuptax_location"
        );
        setupSubsidiary["currency"] = results[0].getValue(
          "custrecord_lmry_setuptax_currency"
        );
      }
      return setupSubsidiary;
    } catch (error) {
      Library_Mail.sendemail( "[ getSetupTaxSubsidiary ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ getSetupTaxSubsidiary ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  function round2(amount) {
    return parseFloat(Math.round(parseFloat(amount) * 1e2 + 1e-14) / 1e2);
  }

  function removeAllItems(recordObj) {
    try{
      while (true) {
        var numberItems = recordObj.getLineCount({sublistId: 'item'});
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
    catch (error) {
      Library_Mail.sendemail('[ removeAllItems ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ removeAllItems ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  function removeAllTaxDetails(recordObj) {
    try{
      while (true) {
        var numberTaxDetails = recordObj.getLineCount({sublistId: 'taxdetails'});
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
    catch (error) {
      Library_Mail.sendemail('[ removeAllTaxDetails ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ removeAllTaxDetails ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  function mergeAttributes(obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
  }

  return {
    setWHTTransaction: setWHTTransaction,
    deleteRelatedRecords: deleteRelatedRecords
  };
});
