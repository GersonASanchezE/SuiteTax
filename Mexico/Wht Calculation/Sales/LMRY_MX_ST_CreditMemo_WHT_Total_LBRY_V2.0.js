/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_MX_ST_CreditMemo_WHT_Total_LBRY_V2.0.js     ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 20 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

 define(["N/log", "N/format", "N/record", "N/search", "N/runtime", "./LMRY_libSendingEmailsLBRY_V2.0", './LMRY_Log_LBRY_V2.0'
],
function (log, format, record, search, runtime, Library_Mail, Library_Log) {
  var LMRY_SCRIPT = "LatamReady - MX ST CreditMemo WHT Total LBRY";
  var LMRY_SCRIPT_NAME = 'LMRY_MX_ST_CreditMemo_WHT_Total_LBRY_V2.0.js';

  var CONFIG_TRANSACTION = {
    // 'invoice': {
    //   'recordtype': 'creditmemo',
    //   "form": "creditmemoform"
    // },
    'creditmemo': {
      'recordtype': 'invoice',
      "form": "invoiceform"
    },
  };
  var FEATURE_TRANSACTION = {
    'invoice': 'CUSTOMAPPROVALCUSTINVC',
  };
  var FEATURE_SUBSIDIARY = false;
  var FEATURE_MULTIBOOK = false;

  var MANDATORY_DEPARTMENT = false;
  var MANDATORY_CLASS = false;
  var MANDATORY_LOCATION = false;

  var MEMO_TRANSACTION = '(LatamTax -  WHT)';
  var MEMO_LINE = ' (LatamTax - WHT) ';
  var WHT_MEMO = 'Latam - WHT Tax';

  var exchangeRate = 0;

  /*********************************************************************************************************
   * Funcion que realiza el calculo de los impuestos.
   * Para Peru: Llamada desde el User Event del Invoice, Credit Memo.
   ********************************************************************************************************/
  function setWHTTransaction(recordObj, scriptContext, licenses) {
    try {
      var type = scriptContext.type;

      var transactionID = "";
      var transactionType = "";

      var transactionID = recordObj.id;
      var transactionType = recordObj.type;

      var appliedWHT = recordObj.getValue({fieldId: "custbody_lmry_apply_wht_code"});

      recordObj = record.load({
        type: transactionType,
        id: transactionID,
        isDynamic: false
      });

      if (type == "edit") {
        deleteRelatedRecords(transactionID);
      }

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

        var transactionDateValue = recordObj.getValue({fieldId: "trandate"});
        var transactionDate = recordObj.getText({fieldId: "trandate"});
        var idCountry = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country"});
        var transactionEntity = recordObj.getValue({fieldId: "entity"});
        var transactionDocumentType = recordObj.getValue({fieldId: 'custbody_lmry_document_type'});

        var filtroTransactionType;
        switch (transactionType) {
          // case "invoice":
          //   filtroTransactionType = 1;
          //   break;
          case "creditmemo":
            filtroTransactionType = 8;
            break;
          default:
            break;
        }

        var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
        exchangeRate = getExchangeRate(recordObj, subsidiary, setupSubsidiary);

        var itemLineCount = recordObj.getLineCount({sublistId: 'item'});

        var taxResults = [];
        var transactionArray = [];

        var approvalFeature = false;
        approvalFeature = runtime.getCurrentScript().getParameter({name: FEATURE_TRANSACTION["invoice"]});

        if (approvalFeature == true || approvalFeature == 'T') {
          var CC_SearchResult = getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, transactionEntity, transactionDocumentType);
          var NT_SearchResult = getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, transactionDocumentType);

          calculateWHTTax(recordObj, taxResults, CC_SearchResult, NT_SearchResult, transactionArray);
          createWHTTransaction(recordObj, transactionArray, setupSubsidiary);
          saveTaxResult(transactionID, subsidiary, idCountry, transactionDateValue, taxResults);
        }
        else {
          Library_Mail.sendemail('[ setWHTTransaction]: The approval routing for the transaction is disabled. ', LMRY_SCRIPT);
          Library_Log.doLog({ title: '[ afterSubmit - setWHTTransaction ]', message: "The approval routing for the transaction is disabled.", relatedScript: LMRY_SCRIPT_NAME });

          return true;
        }

      } // Fin if appliedWht
    } catch (error) {
      // log.error("[ afterSubmit - setWHTTransaction ]", error)
      Library_Mail.sendemail('[ afterSubmit - setWHTTransaction ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ afterSubmit - setWHTTransaction ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }


  /***************************************************************************
  * FUNCION PARA CALCULAR LAS RETENCIONES
  *    - recordObj: Registro de la transaccion
  *    - CC_SearchResult: Resultado de la busqueda de Contributory Classes
  *    - NT_SearchResult: Resultado de la busqueda de National Taxes
  *    - whtResult: Json donde se acumulará los Tax Result
  ***************************************************************************/
  function calculateWHTTax(recordObj, whtResult, CC_SearchResult, NT_SearchResult, transactionArray) {
    try {
      if (CC_SearchResult != null && CC_SearchResult.length > 0) {
        for (var i = 0; i < CC_SearchResult.length; i++) {

          var CC_internalID = CC_SearchResult[i].getValue({ name: "internalid" });
          var CC_taxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_co_ccl_taxrate" });
          var CC_generatedTransaction = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_gen_transaction" });
          var CC_generatedTransactionID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_gen_transaction" });
          var CC_taxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_taxtype" });
          var CC_taxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_taxtype" });
          var CC_subtypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
          var CC_subtype = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
          var CC_Department = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_department" });
          var CC_DepartmentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_department" });
          var CC_Class = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_class" });
          var CC_ClassID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_class" });
          var CC_Location = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_location" });
          var CC_LocationID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_location" });
          var CC_taxItem = CC_SearchResult[i].getValue({name: "custrecord_lmry_ar_ccl_taxitem"});
          var CC_taxCode = CC_SearchResult[i].getValue({name: "custrecord_lmry_ar_ccl_taxcode"});
          var CC_amountTo = CC_SearchResult[i].getValue('custrecord_lmry_amount');
          var CC_appliesTo= CC_SearchResult[i].getValue("custrecord_lmry_ccl_appliesto");
          var minimo = CC_SearchResult[i].getValue("custrecord_lmry_ccl_minamount");
          var CC_whtDescription = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_description" });

          if (minimo == null || minimo == '' || minimo < 0) {
            minimo = 0;
          }

          minimo = parseFloat(minimo);

          // log.error("CC_SearchResult*", CC_SearchResult[i]);
          var subtotal_invoice = parseFloat(recordObj.getValue("subtotal")) * parseFloat(exchangeRate);
          var total_invoice = parseFloat(recordObj.getValue("total")) * parseFloat(exchangeRate);
          var taxtotal_invoice = parseFloat(recordObj.getValue("taxtotal")) * parseFloat(exchangeRate);
          var amount_base = 0;

          if (CC_appliesTo == '1') { // total
            if (CC_amountTo == 1) { // GROSS
              amount_base = total_invoice;
            }
            if (CC_amountTo == 2) { // TAX TOTAL
              if (taxtotal_invoice > 0) {
                amount_base = taxtotal_invoice;
              } else {
                continue;
              }
            }
            if (CC_amountTo == 3) { // NET
              amount_base = subtotal_invoice;
            }
          }

          if (amount_base <= 0) {
            continue;
          }

          if (minimo > 0) {
            if (amount_base <= minimo) {
              continue;
            }
          }

          // taxInformation[CC_internalID] = [CC_taxItem, CC_taxCode];
          var WHTAmount = parseFloat(parseFloat(CC_taxRate) * amount_base) / exchangeRate / 100;

          amount_base = amount_base / exchangeRate;

          whtResult.push({
            taxtype: {
              text: CC_taxType,
              value: CC_taxTypeID
            },
            subtype: {
              text: CC_subtypeID,
              value: CC_subtype
            },
            lineuniquekey: "",
            baseamount: amount_base,
            whtamount: round2(WHTAmount),
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
              text: "",
              value: ""
            },
            expenseacc: {},
            position: "",
            description: "",
            lc_baseamount: amount_base * exchangeRate,
            lc_whtamount: WHTAmount * exchangeRate,
          });

          if ( CC_generatedTransactionID == "5" ) {
            var auxTransJson = {
              contributoryClass: CC_internalID,
              nationalTax: "",
                subtype: {
                    text: CC_subtypeID,
                    value: CC_subtypeID
                },
                taxitem: CC_taxItem,
                taxcode: CC_taxCode,
                department: CC_DepartmentID,
                class: CC_ClassID,
                location: CC_LocationID,
                whtamount: Math.round(WHTAmount * 100) / 100,
                description: CC_whtDescription
            };
            transactionArray.push(auxTransJson);
          }

        } // FIN FOR CONTRIBUTORY CLASS
      }
      else {
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
            var minimo = NT_SearchResult[i].getValue("custrecord_lmry_ntax_minamount");
            var NT_whtDescription = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_description" });

            if (minimo == null || minimo == '' || minimo < 0) {
              minimo = 0;
            }

            minimo = parseFloat(minimo);

            var subtotal_invoice = parseFloat(recordObj.getValue("subtotal")) * parseFloat(exchangeRate);
            var total_invoice = parseFloat(recordObj.getValue("total")) * parseFloat(exchangeRate);
            var taxtotal_invoice = parseFloat(recordObj.getValue("taxtotal")) * parseFloat(exchangeRate);
            var amount_base = 0;

            if (NT_appliesTo == '1') { // total
              if (NT_amountTo == 1) { // GROSS
                amount_base = total_invoice;
              }
              if (NT_amountTo == 2) { // TAX TOTAL
                if (taxtotal_invoice > 0) {
                  amount_base = taxtotal_invoice;
                } else {
                  continue;
                }
              }
              if (NT_amountTo == 3) { // NET
                amount_base = subtotal_invoice;
              }
            }

            if (amount_base <= 0) {
              continue;
            }

            if (minimo > 0) {
              if (amount_base <= minimo) {
                continue;
              }
            }

            // taxInformation[NT_internalID] = [NT_taxItem, NT_taxCode];
            var WHTAmount = parseFloat(parseFloat(NT_taxRate) * amount_base) / exchangeRate / 100;

            amount_base = amount_base / exchangeRate;

            whtResult.push({
              taxtype: {
                text: NT_taxType,
                value: NT_taxTypeID
              },
              subtype: {
                text: NT_subtype,
                value:  NT_subtypeID
              },
              lineuniquekey: "",
              baseamount: amount_base,
              whtamount: round2(WHTAmount),
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
                text: "",
                value: ""
              },
              expenseacc: {},
              position: "",
              description: "",
              lc_baseamount: amount_base * exchangeRate,
              lc_whtamount: WHTAmount * exchangeRate,
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
                department: NT_DepartmentID,
                class: NT_ClassID,
                location: NT_LocationID,
                whtamount: Math.round(WHTAmount * 100) / 100,
                description: NT_whtDescription
              };
              transactionArray.push(auxTransJson);

            }
          } // FIN FOR NATIONAL TAX
        }
      }

    }
    catch (error) {
      // log.error("[ calculateWHTTax ]: ", error)
      Library_Mail.sendemail( "[ calculateWHTTax ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ calculateWHTTax ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /******************************************************************************
  * FUNCION PARA GENERAR TRANSACCIONES SI HAY RETENCIONES APLCIADAS
  *    - recordObj: Registro de la transaccion
  *    - transactionArray: Detalle de las reteciones
  *    - STS_Json: Json con data del record LatamReady - Setup Tax Subsidiary
  ******************************************************************************/
  function createWHTTransaction(recordObj, transactionArray, STS_Json) {

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
        var transactionForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_invoice" });
        var toType = CONFIG_TRANSACTION[recordType]['recordtype'];

        var groupsInformationWht = [];
        for (var i in transactionArray) {
          var auxArray = [];
          auxArray.push(transactionArray[i]);
          groupsInformationWht.push( auxArray );
        }

        for (var subtypeID in groupsInformationWht) {
          var groupWht = groupsInformationWht[subtypeID];

          var newRecordObj = record.create({
            type: toType,
            isDynamic: true
          });

          newRecordObj.setValue("customform", transactionForm);
          newRecordObj.setValue("entity", entity);
          newRecordObj.setValue("subsidiary", subsidiary);
          newRecordObj.setValue('trandate', date);
          newRecordObj.setValue('postingperiod', postingperiod);
          newRecordObj.setValue('memo', "Latam - STE MX WHT " + groupWht[0]["subtype"]["text"] + " (Total)");
          newRecordObj.setValue('account', account);
          newRecordObj.setValue('exchangerate', exchangeRate);
          newRecordObj.setValue('currency', currency);
          newRecordObj.setValue("taxdetailsoverride", true);

          newRecordObj.setValue('custbody_lmry_reference_transaction', idTransaction);
          newRecordObj.setValue('custbody_lmry_reference_transaction_id', idTransaction);
          newRecordObj.setValue('custbody_lmry_reference_entity', entity);
          newRecordObj.setValue("entitytaxregnum", transactionEntityTaxRegNumer);
          newRecordObj.setValue("approvalstatus", 2);

          if (transactionNexusOverride == true || transactionNexusOverride == "T") {
            var transactionNexus = recordObj.getValue("nexus");
            newRecordObj.setValue("nexus", transactionNexus);
          }

          for (var i in groupWht) {
            var informationWHT = groupWht[i];

            var taxItem = informationWHT["taxitem"];
            var taxCode = informationWHT["taxcode"];

            var taxType = search.lookupFields({type: 'salestaxitem', id: taxCode, columns: ["taxtype"]});
            taxType = taxType.taxtype[0].value;

            var newDeparment = "";
            var newClass = "";
            var newLocation = "";

            if (STS_Json.depclassloc == true || STS_Json.depclassloc == "T") {
              newDeparment = informationWHT["department"];
              newClass = informationWHT["class"];
              newLocation = informationWHT["location"];
            } else {
              newDeparment = (MANDATORY_DEPARTMENT == true)? transactionDeparment: STS_Json.department;
              newClass = (MANDATORY_CLASS == true)? transactionClass: STS_Json.class;
              newLocation = (MANDATORY_LOCATION == true)? transactionLocation: STS_Json.location;
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

          idNewRecord = newRecordObj.save({
            ignoreMandatoryFields: true,
            disableTriggers: true,
            enableSourcing: true
          });
          // log.error("idnew", idNewRecord);

          newRecordArray.push(Number(idNewRecord));

        }
        applyTransaction (newRecordArray, recordObj);
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
  * GUARDAR TAX RESULT EN EL RECORD: LATAMREADY - LATAMTAX TAX RESULT
  *    - transaction: ID de la Transaccion
  *    - subsidiary: Subsidiaria
  *    - country: Pais
  *    - transactionDate: Fecha de la transacción
  *    - TResultWth: JSON de Tax Results
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
        ["custrecord_lmry_ccl_gen_transaction", "anyof", "5"], //1:Journal, 2:SuiteGL, 3:LatamTax(Purchase), 4:Add Line, 5: Wht by Trans, 6: LatamTax (Sales)
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
          "custrecord_lmry_ar_ccl_taxitem",
          "custrecord_lmry_ar_ccl_taxcode",
          "custrecord_lmry_ccl_appliesto",
          "custrecord_lmry_amount",
          "custrecord_lmry_ccl_minamount",
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
        ["custrecord_lmry_ntax_gen_transaction", "anyof", "5"],
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
          "custrecord_lmry_co_ntax_taxrate",
          "custrecord_lmry_ntax_taxtype",
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
          "custrecord_lmry_ntax_minamount",
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
        setupSubsidiary["isDefaultClassification"] = results[0].getValue(
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

  /***************************************************************************
   * Funcion que elimina los Journal y Registros del record
   * LatamReady - LatamTax Tax Results" en caso se elimine la transacción
   * llamada desde el User Event del Invoice, Credit Memo, Bill y Bill Credit
   *    - transactionID: ID de la transaccion
   *    - transactionType: Tipo de transaccion
   ***************************************************************************/
   function deleteRelatedRecords(transactionID) {
    try {
      // BUSQUEDA DE TRANSACCIONES RELACIONADAS
      var relatedIDs = [];
      var Transaction_Search = search.create({
        type: "invoice",
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
            type: "creditmemo",
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
          type: search.Type.INVOICE,
          id: relatedIDs[i]
        });
      }

      // BUSQUEDA DE JOURNALA ENTRY RELACIONADOS
      // var JE_Search = search.create({
      //   type: search.Type.JOURNAL_ENTRY,
      //   columns: ["internalid"],
      //   filters: [
      //     ["custbody_lmry_reference_transaction", "IS", transactionID]
      //   ]
      // });
      // var JE_SearchResult = JE_Search.run().getRange(0, 1000);
      // var auxID = 0;
      // if (JE_SearchResult != null && JE_SearchResult.length != 0) {
      //   for (var i = 0; i < JE_SearchResult.length; i++) {
      //     var JE_ID = JE_SearchResult[i].getValue("internalid");
      //     if (auxID != JE_ID) {
      //       auxID = JE_ID;
      //       record.delete({
      //         type: record.Type.JOURNAL_ENTRY,
      //         id: JE_ID
      //       });
      //     }
      //   }
      // }
    } catch (e) {
      // log.error("deleteRelatedRecords", e);
      Library_Mail.sendemail('[ deleteRelatedRecords ]' + e, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ deleteRelatedRecords ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
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

  return {
    setWHTTransaction: setWHTTransaction,
    deleteRelatedRecords: deleteRelatedRecords
  };
});
