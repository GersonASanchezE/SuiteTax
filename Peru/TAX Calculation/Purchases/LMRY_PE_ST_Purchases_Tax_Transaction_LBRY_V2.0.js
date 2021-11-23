/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_PE_ST_Purchases_Tax_Transaction_LBRY_V2.0.js||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 20 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(["N/log", "N/format", "N/record", "N/search", "N/runtime", "./LMRY_libSendingEmailsLBRY_V2.0", './LMRY_Log_LBRY_V2.0'
],
function (log, format, record, search, runtime, Library_Mail, Library_Log) {
  var LMRY_SCRIPT = "LatamReady - PE ST Purchases Transaction LBRY";
  var LMRY_SCRIPT_NAME = 'LMRY_PE_ST_Purchases_Tax_Transaction_LBRY_V2.0.js';

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
  var FEATURE_SUBSIDIARY = false;
  var FEATURE_MULTIBOOK = false;

  var MEMO_TRANSACTION = '(LatamTax -  DET)';
  var MEMO_LINE = ' (LatamTax - DET) ';
  var WHT_MEMO = 'Latam - DET Tax';

  var exchangeRate = 0;

  /*********************************************************************************************************
   * Funcion que realiza el calculo de los impuestos.
   * Para Peru: Llamada desde el User Event del Bill, Credit Memo.
   ********************************************************************************************************/
  function setTaxTransaction(scriptContext, licenses) {
    try {
      var recordObj = scriptContext.newRecord;
      var type = scriptContext.type;

      if (type == "create" || type == "edit" || type == "copy") {
        var recordId = "";
        var transactionType = "";

        recordId = scriptContext.newRecord.id;
        transactionType = scriptContext.newRecord.type;
        
        var override = recordObj.getValue({fieldId: "taxdetailsoverride"});

        if (override == true || override == "T") {
          
          FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({feature: "SUBSIDIARIES",});
          FEATURE_MULTIBOOK = runtime.isFeatureInEffect({feature: "MULTIBOOK"});

          var subsidiary;
          if (FEATURE_SUBSIDIARY) {
            subsidiary = recordObj.getValue({fieldId: "subsidiary"});
          } else {
            subsidiary = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country",});
          }
          
          var idCountry = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country"});
          var transactionEntity = recordObj.getValue({fieldId: "entity"});
          var transactionDate = recordObj.getText({fieldId: "trandate"});
          var transactionDocumentType = recordObj.getValue({fieldId: "custbody_lmry_document_type"});
          var documentDetractionConcept = recordObj.getValue({fieldId: "custbody_lmry_concepto_detraccion"});

          // Variable con el id de la transaccion que se enviara como filtro para la CC y NT
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

          var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
          exchangeRate = getExchangeRate(recordObj, subsidiary, setupSubsidiary);
          
          var itemLineCount = recordObj.getLineCount({sublistId: "item"});

          var taxResults = [];
          var taxInformation = {};
          var flagCC = false; 

          if (itemLineCount != "" && itemLineCount != 0) {
            var CC_SearchResult = getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, transactionEntity, transactionDocumentType, documentDetractionConcept);
            log.error("CC_SearchResult", CC_SearchResult)
            if (CC_SearchResult != null && CC_SearchResult.length > 0){
              flagCC = true;
              setTaxes(recordObj, CC_SearchResult, [], taxResults);
              setDetractions(taxResults, CC_SearchResult, [], flagCC, taxInformation);
            }
            else {
              var NT_SearchResult = getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, transactionDocumentType, documentDetractionConcept);
              if (NT_SearchResult != null && NT_SearchResult.length > 0) {
                setTaxes(recordObj, [], NT_SearchResult, taxResults);
                setDetractions(taxResults, [], NT_SearchResult, flagCC, taxInformation);
              }
            }
          }

          var TResultTax = [];
          var TResultDet = [];
          
          for (var i = 0; i < taxResults.length; i++) {
            if (taxResults[i]["taxtype"]["value"] == '4'){
              TResultTax.push(taxResults[i]);
            }
            else if (taxResults[i]["taxtype"]["value"] == '3') {
              TResultDet.push(taxResults[i]);
            }
          }

          log.error("taxResults", taxResults)

          //Actualizar TaxResults
          if(TResultDet.length > 0) {
            var totalGross = 0.0;
            if(TResultTax.length > 0) { // Si hay calculo de impuestos
              for (var i = 0; i < TResultTax.length; i++) {
                totalGross += TResultTax[i]["baseamount"] + TResultTax[i]["taxamount"]; 
              }
            }
            else{
              totalGross = recordObj.getValue("total");
            }

            // log.error("TResultDet1", TResultDet)

            var k = 0;
            for (var i = 0; i < taxResults.length; i++) {
              if (taxResults[i]["taxtype"]["value"] == '3') {
                var taxrateTR = parseFloat(taxResults[i]["taxrate"]);
                taxResults[i]["baseamount"] = totalGross;
                taxResults[i]["taxamount"] = round2(parseFloat(taxrateTR * totalGross));
                taxResults[i]["lc_baseamount"] = taxResults[i]["baseamount"]* exchangeRate;
                taxResults[i]["lc_taxamount"] = taxResults[i]["taxamount"]* exchangeRate;
                taxResults[i]["lc_baseamount"] = (taxResults[i]["taxamount"] + taxResults[i]["lc_taxamount"]) * exchangeRate;

                TResultDet[k]["baseamount"] = totalGross;
                TResultDet[k]["taxamount"] = round2(parseFloat(taxrateTR * totalGross));
                k++;
              }
            }

            if (FEATURE_TRANSACTION[transactionType]) {
              var approvalFeature = runtime.getCurrentScript().getParameter({name: FEATURE_TRANSACTION[transactionType]});
            }

            var approvalStatus = 0;
            approvalStatus = recordObj.getValue({fieldId: 'approvalstatus'});

            if ((approvalFeature == false || approvalFeature == 'F') || ((approvalFeature == true || approvalFeature == 'T') && (approvalStatus && Number(approvalStatus) == 2))) {
              // log.error("TResultDet2", TResultDet)
              createWHTTransaction(recordObj, TResultDet, taxInformation, licenses, flagCC);
            } // Fin IF status
            
          }

          saveTaxResult(recordId, subsidiary, idCountry, TResultTax, TResultDet);
          
        } // Fin if taxdetailsoverride
      } // Fin If create, edit o copy
      return recordObj;
    } catch (error) {
      Library_Mail.sendemail('[ afterSubmit - setTaxTransaction ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ afterSubmit - setTaxTransaction ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

   /***************************************************************************
  * FUNCION PARA GENERAR UN CREDIT MEMO SI HAY DETRACCIONES APLCIADOS AL BILL
  *    - recordObj: Registro de la transaccion
  *    - taxResults: Json donde se acumulará los Tax Result
  *    - taxInformation: Informacion del CC o NT
  *    - licenses: Licencias
  *    - flagCC: Booleano para saber si se encontró CC
  ***************************************************************************/
  function createWHTTransaction(recordObj, taxResults, taxInformation, licenses, flagCC) {
    try{
      var recordType = recordObj.getValue('baserecordtype');
  
      var idTransaction = recordObj.id;
      var idNewRecord = null;
  
      if (CONFIG_TRANSACTION[recordType]) {

        var transactionEntity = recordObj.getValue('entity');
        var subsidiary = recordObj.getValue("subsidiary");
        var date = recordObj.getValue('trandate');
        date = format.parse({value: date,type: format.Type.DATE});
        var postingperiod = recordObj.getValue('postingperiod');
        var departmentTr = recordObj.getValue('department');
        var classTr = recordObj.getValue('class');
        var locationTr = recordObj.getValue('location');
        var departmentFeat = runtime.isFeatureInEffect({feature: "DEPARTMENTS"});
        var locationFeat = runtime.isFeatureInEffect({feature: "LOCATIONS"});
        var classFeat = runtime.isFeatureInEffect({feature: "CLASSES"});
        var account = recordObj.getValue('account');
        var exchangeRate = recordObj.getValue('exchangerate');
        var currency = recordObj.getValue('currency');
  
        var fromType = "vendorbill";
        var fromId = idTransaction;
        if (recordType == "vendorcredit") {
          fromType = "vendor";
          fromId = transactionEntity;
        }
        var toType = CONFIG_TRANSACTION[recordType]['recordtype'];
        
        var useGroupFeature = false;
        if (licenses) {
          useGroupFeature = library.getAuthorization(661, licenses);
        }
        if(useGroupFeature){
          var groupTaxResults = {
            "taxResults": taxResults
          }
        }
        else{
          if(flagCC) {
            var groupTaxResults = taxResults.reduce(function(rv, x) {
              rv[x["contributoryClass"]] = rv[x["contributoryClass"]] || [];
              rv[x["contributoryClass"]].push(x);
              return rv;
            }, {});
          }
          else {
            var groupTaxResults = taxResults.reduce(function(rv, x) {
              rv[x["nationalTax"]] = rv[x["nationalTax"]] || [];
              rv[x["nationalTax"]].push(x);
              return rv;
            }, {});
          }
        }
        var arrayKeys = Object.keys(groupTaxResults);
        // log.error("USE GROUP", JSON.stringify(arrayKeys));
        
        var TOTAL_AMOUNT_WHT = 0.0;

        for (var k = 0; k < arrayKeys.length; k++) {
          var taxResults_array = groupTaxResults[arrayKeys[k]];
          // log.error("taxResults_array", taxResults_array);

          var recordTransaction = record.transform({
            fromType: fromType,
            fromId: fromId,
            toType: toType,
            isDynamic: false
          });

          if (toType == "vendorBill") {
            recordTransaction.setValue("subsidiary", subsidiary);
            recordTransaction.setValue("entity", transactionEntity);
          }
          recordTransaction.setValue('trandate', date);
          recordTransaction.setValue('postingperiod', postingperiod);
          recordTransaction.setValue('memo', MEMO_TRANSACTION);
          recordTransaction.setValue('account', account);
          recordTransaction.setValue('exchangerate', exchangeRate);
          recordTransaction.setValue('currency', currency);
          recordTransaction.setValue('custbody_lmry_reference_transaction', idTransaction);
          recordTransaction.setValue('custbody_lmry_reference_transaction_id', idTransaction);
          recordTransaction.setValue('custbody_lmry_reference_entity', transactionEntity);
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
  
          //Limpiar campos copiados del Bill
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
            removeAllExpenses(recordTransaction);
            removeAllTaxDetails(recordTransaction);
          }

          var amountWHT = 0.0; 
          for (var i = 0; i < taxResults_array.length; i++) {
            var taxResult = taxResults_array[i];

            if(taxResult["contributoryClass"] != ""){
              var taxItem = taxInformation[taxResult["contributoryClass"]][0];;
              var taxCode = taxInformation[taxResult["contributoryClass"]][1];
            }
            else{
              var taxItem = taxInformation[taxResult["nationalTax"]][0];;
              var taxCode = taxInformation[taxResult["nationalTax"]][1];
            }
            
            var taxType = search.lookupFields({type: 'salestaxitem', id: taxCode, columns: ["taxtype"]});
            taxType = taxType.taxtype[0].value;

            amountWHT += taxResult["taxamount"];

            recordTransaction.insertLine({sublistId: 'item',line: i});
            recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'item', value: taxItem, line: i});
            recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'rate', value: taxResult["taxamount"], line: i});
            recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'amount', value: taxResult["taxamount"], line: i});
    
            var description = taxResult['subtype']["text"] + MEMO_LINE;
    
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
  
          idNewRecord = setTaxDetailBillCredit(recordObj, idNewRecord, taxResults_array, taxCode, taxType);
          log.error("idNewRecord", idNewRecord);
          
          
          // if (idNewRecord) {
          //   TOTAL_AMOUNT_WHT += parseFloat(search.lookupFields({
          //     type: toType,
          //     id: idNewRecord,
          //     columns: ["fxamount"]
          //   }).fxamount) || 0.00;
          // }
          // log.error('TOTAL_AMOUNT_WHT', TOTAL_AMOUNT_WHT);
        }
        
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
    catch (error){
      Library_Mail.sendemail('[ createWHTTransaction ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ createWHTTransaction ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /********************************************************************************
  * FUNCION PARA SETEAR EN EL TAX DETAIL DEL BILL CREDIT GENERADO
  *    - invoiceObj: Registro de la transaccion
  *    - creditMemoId: ID del Credit Memo generado
  *    - taxResults_array: Json donde se acumuló los Tax Result de tipo Detraccion
  *    - taxCode: Tax Code
  *    - taxType: Tax Type
  ********************************************************************************/
  function setTaxDetailBillCredit(billObj, vendorcreditId, taxResults_array, taxCode, taxType) {
    try {
      log.error("taxResult", taxResults_array)
      var recordObj = record.load({
        type: 'vendorcredit',
        id: vendorcreditId,
        isDynamic: false
      });

      // Tax Details fields del Invoice
      var nexus = billObj.getValue({ fieldId: 'nexus' });
      var nexusOverRide = billObj.getValue({ fieldId: 'taxregoverride' });
      var transactionType = billObj.getValue({ fieldId: 'custbody_ste_transaction_type' });
      var subTaxRegNumber = billObj.getValue({ fieldId: 'subsidiarytaxregnum' });
      var entityTaxRegNumber = billObj.getValue({ fieldId: 'entitytaxregnum' });

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
        recordObj.setSublistValue({sublistId: 'taxdetails',fieldId: 'taxrate',line: i,value: parseFloat(parseFloat(taxResults_array[i]['taxrate']) * 100)});
        recordObj.setSublistValue({sublistId: 'taxdetails',fieldId: 'taxamount',line: i,value: 0.00});
      }

      var recordId = recordObj.save({
        ignoreMandatoryFields: true,
        disableTriggers: true,
        enableSourcing: true
      });

      return recordId;
    } catch (error) {
      Library_Mail.sendemail('[ setTaxDetailBillCredit ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ setTaxDetailBillCredit ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
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
    catch (error) {
      Library_Mail.sendemail('[ removeAllItems ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ removeAllItems ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
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
    catch (error) {
      Library_Mail.sendemail('[ removeAllTaxDetails ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ removeAllTaxDetails ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
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
    catch (error) {
      Library_Mail.sendemail('[ removeAllExpenses ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ removeAllExpenses ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
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
  function saveTaxResult(transaction, subsidiary, country, TResultTax, TResultWth) {
    try {
      var resultSearchTR = search.create({
          type: "customrecord_lmry_latamtax_tax_result",
          columns: ["id"],
          filters: [
            "custrecord_lmry_tr_related_transaction",
            "is",
            transaction,
          ],
        }).run().getRange({ start: 0, end: 10 });

      if (resultSearchTR != null && resultSearchTR.length > 0) {
        var recordId = resultSearchTR[0].getValue("id");

        record.submitFields({
          type: "customrecord_lmry_latamtax_tax_result",
          id: recordId,
          values: {
            custrecord_lmry_tr_subsidiary: subsidiary,
            custrecord_lmry_tr_country: country,
            custrecord_lmry_tr_tax_transaction: JSON.stringify(TResultTax),
            custrecord_lmry_tr_wht_transaction: JSON.stringify(TResultWth)
          },
          options: {
            enableSourcing: false,
            ignoreMandatoryFields: true,
          },
        });
      } else {
        var recordTR = record.create({
          type: "customrecord_lmry_latamtax_tax_result",
          isDynamic: false,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_tr_related_transaction",
          value: transaction,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_tr_subsidiary",
          value: subsidiary,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_tr_country",
          value: country,
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_tr_tax_transaction",
          value: JSON.stringify(TResultTax),
        });
        recordTR.setValue({
          fieldId: "custrecord_lmry_tr_wht_transaction",
          value: JSON.stringify(TResultWth),
        });
        recordTR.save({
          enableSourcing: true,
          ignoreMandatoryFields: true,
          disableTriggers: true,
        });
      }
    } catch (error) {
      Library_Mail.sendemail('[ saveTaxResult ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ saveTaxResult ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
    * BUSQUEDA DEL RECORD: LATMAREADY - CONTRIBUTORY CLASS
    *    - subsidiary: Subsiaria
    *    - transactionDate: Fecha de creación de la transacción
    *    - filtroTransactionType: Vendor Bill 
    *    - entity: ID de la Entidad
    *    - documentType: Tipo de Documento Fiscal
    ***************************************************************************/
  function getContributoryClasses (subsidiary, transactionDate, filtroTransactionType, entity, documentType, detraction_concept) {
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
        ["custrecord_lmry_ccl_taxtype", "anyof", ["3", "4"]], //1:Retencion, 2:Percepcion, 3:Detraccion, 4:Calculo de Impuesto
        "AND",
        ["custrecord_lmry_ccl_gen_transaction", "anyof", "3"], //1:Journal, 2:SuiteGL, 3:LatamTax(Purchase), 4:Add Line, 5: WhtbyTrans, LatamTax (Sales)
      ];
  
      var documents = ["@NONE@"];
      if (documentType) {
        documents.push(documentType);
      }
      filtrosCC.push("AND", ["custrecord_lmry_ccl_fiscal_doctype", "anyof", documents]);
  
      var detractions = ["@NONE@"];
      if (detraction_concept) {
        detractions.push(detraction_concept);
      }
      filtrosCC.push("AND", ["custrecord_lmry_cc_pe_detraction_concept", "anyof", detractions]);
  
      if (FEATURE_SUBSIDIARY) {
        filtrosCC.push("AND", ["custrecord_lmry_ar_ccl_subsidiary", "anyof", subsidiary]);
      }
  
      var searchCC = search.create({
        type: "customrecord_lmry_ar_contrib_class",
        columns: [
          "custrecord_lmry_ar_ccl_taxrate",
          "internalid",
          "custrecord_lmry_sub_type",
          "custrecord_lmry_br_ccl_account1",
          "custrecord_lmry_br_ccl_account2",
          "custrecord_lmry_ccl_gen_transaction",
          "custrecord_lmry_ar_ccl_department",
          "custrecord_lmry_ar_ccl_class",
          "custrecord_lmry_ar_ccl_location",
          "custrecord_lmry_ccl_applies_to_account",
          "custrecord_lmry_ar_ccl_taxitem",
          "custrecord_lmry_ccl_taxtype",
          "custrecord_lmry_ccl_description",
          "custrecord_lmry_cc_invoice_identifier",
          "custrecord_lmry_cc_ste_tax_type",
          "custrecord_lmry_cc_ste_tax_code",
          "custrecord_lmry_ar_ccl_taxcode",
          "custrecord_lmry_cc_pe_detraction_concept",
        ],
        filters: filtrosCC,
      });
  
      var searchResultCC = searchCC.run().getRange({
        start: 0,
        end: 1000
      });
      return searchResultCC;
    }
    catch (error) {
      Library_Mail.sendemail('[ getContributoryClasses ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ getContributoryClasses ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
    * BUSQUEDA DEL RECORD: LATMAREADY - NATIONAL TAX
    *    - subsidiary: Subsiaria
    *    - transactionDate: Fecha de creación de la transacción
    *    - filtroTransactionType: Vendor Bill
    *    - entity: ID de la Entidad
    *    - documentType: Tipo de Documento Fiscal
    ***************************************************************************/
  function getNationalTaxes (subsidiary, transactionDate, filtroTransactionType, documentType, detraction_concept) {
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
        ["custrecord_lmry_ntax_taxtype", "anyof", ["3", "4"]],
        "AND",
        ["custrecord_lmry_ntax_gen_transaction", "anyof", "3"]
        // "AND",
        // ["custrecord_lmry_nt_pe_detraction_concept", "is", detraction_concept]
      ];
      var detractions = ["@NONE@"];
      if (detraction_concept) {
        detractions.push(detraction_concept);
      }
      filtrosNT.push("AND", ["custrecord_lmry_nt_pe_detraction_concept", "anyof", detractions]);
  
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
          "custrecord_lmry_ntax_taxrate",
          "internalid",
          "custrecord_lmry_ntax_taxtype",
          "custrecord_lmry_ntax_sub_type",
          "custrecord_lmry_ntax_debit_account",
          "custrecord_lmry_ntax_credit_account",
          "custrecord_lmry_ntax_gen_transaction",
          "custrecord_lmry_ntax_department",
          "custrecord_lmry_ntax_class",
          "custrecord_lmry_ntax_location",
          "custrecord_lmry_ntax_description",
          "custrecord_lmry_ntax_taxitem",
          "custrecord_lmry_nt_invoicing_identifier",
          "custrecord_lmry_ntax_appliesto",
          "custrecord_lmry_nt_ste_tax_type",
          "custrecord_lmry_nt_ste_tax_code",
          "custrecord_lmry_ntax_taxcode",
          "custrecord_lmry_nt_pe_detraction_concept"
  
        ],
        filters: filtrosNT,
      });
      var searchResultNT = searchNT.run().getRange({
        start: 0,
        end: 1000,
      });
      return searchResultNT;
    }
    catch (error) {
      Library_Mail.sendemail('[ getNationalTaxes ]: ' + error, LMRY_SCRIPT);
      Library_Log.doLog({ title: '[ getNationalTaxes ]', message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
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
      Library_Mail.sendemail( "[ getInvoicingIdentifierJSON ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ getInvoicingIdentifierJSON ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * FUNCION PARA CALCULAR LOS IMPUESTOS DE TIPO "CALCULO DE IMPUESTOS",
  * SETEAR EN TAX DETAILS Y GENERAR TAX RESULT
  *    - recordObj: Registro de la transaccion
  *    - CC_SearchResult: Resultado de la busqueda de Contributory Classes
  *    - NT_SearchResult: Resultado de la busqueda de National Taxes
  *    - taxResults: Json donde se acumulará los Tax Result
  ***************************************************************************/
  function setTaxes(recordObj, CC_SearchResult, NT_SearchResult, taxResults) {
    try {
      var itemLineCount = recordObj.getLineCount({sublistId: "item"});
      var expenseLineCount = recordObj.getLineCount({ sublistId: "expense" });
  
      var lastDetailLine = 0;
  
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
          var CC_taxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxrate" });
          var CC_invIdent = CC_SearchResult[i].getText({ name: "custrecord_lmry_cc_invoice_identifier" });
          var CC_Department = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_department" });
          var CC_DepartmentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_department" });
          var CC_Class = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_class" });
          var CC_ClassID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_class" });
          var CC_Location = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_location" });
          var CC_LocationID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_location" });
          
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
                    var taxAmount = round2(taxAmountNoRounded);
                  
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
                    var taxAmount = round2(taxAmountNoRounded);
  
                    recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: expenseDetailReference });
                    recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: CC_STE_taxTypeID });
                    recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: CC_STE_taxCodeID });
                    recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(expenseNetAmount) });
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
             
            } // FIN FOR EXPENSE COUNT
          } // FIN IF EXPENSE COUNT
  
        } // FIN FOR CONTRIBUTORY CLASS
      } // FIN IF CONTRIBUTORY CLASS
      else { 
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
            var NT_invIdent = NT_SearchResult[i].getText({ name: "custrecord_lmry_nt_invoicing_identifier" });
            var NT_Department = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_department" });
            var NT_DepartmentID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_department" });
            var NT_Class = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_class" });
            var NT_ClassID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_class" });
            var NT_Location = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_location" });
            var NT_LocationID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_location" });
           
  
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
                      var taxAmount = round2(taxAmountNoRounded);
  
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
                    }
                  } else {
                      break;
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
                      var taxAmount = round2(taxAmountNoRounded);
  
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: lastDetailLine, value: expenseDetailReference });
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: lastDetailLine, value: NT_STE_taxTypeID });
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: lastDetailLine, value: NT_STE_taxCodeID });
                      recordObj.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: lastDetailLine, value: parseFloat(expenseNetAmount) });
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
                
              } // FIN FOR EXPENSE COUNT
            } // FIN IF EXPENSE COUNT
  
          } // FIN FOR NATIONAL TAX
        } // FIN IF NATIONAL TAX
      }
    }
    catch (error) {
      Library_Mail.sendemail( "[ setTaxes ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ setTaxes ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
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
  function setDetractions(taxResults, CC_SearchResult, NT_SearchResult, flagCC, taxInformation) {
    try {
      if(flagCC) {
        for (var i = 0; i < CC_SearchResult.length; i++) {
  
          var CC_taxTypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_taxtype" });
          
          if (CC_taxTypeID == '3') {
            var CC_internalID = CC_SearchResult[i].getValue({ name: "internalid" });
            var CC_generatedTransaction = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_gen_transaction" });
            var CC_generatedTransactionID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ccl_gen_transaction" });
            var CC_taxType = CC_SearchResult[i].getText({ name: "custrecord_lmry_ccl_taxtype" });
            var CC_subtypeID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
            var CC_subtype = CC_SearchResult[i].getValue({ name: "custrecord_lmry_sub_type" });
            var CC_taxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxrate" });
            var CC_Department = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_department" });
            var CC_DepartmentID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_department" });
            var CC_Class = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_class" });
            var CC_ClassID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_class" });
            var CC_Location = CC_SearchResult[i].getText({ name: "custrecord_lmry_ar_ccl_location" });
            var CC_LocationID = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_location" });
            var CC_taxItem = CC_SearchResult[i].getValue({name: "custrecord_lmry_ar_ccl_taxitem"});
            var CC_taxCode = CC_SearchResult[i].getValue({name: "custrecord_lmry_ar_ccl_taxcode"});
            // log.error("CC_SearchResult*", CC_SearchResult[i]);
    
            taxInformation[CC_internalID] = [CC_taxItem, CC_taxCode];
    
            taxResults.push({
              taxtype: {
                text: CC_taxType,
                value: CC_taxTypeID
              },
              subtype: {
                text: CC_subtypeID,
                value: CC_subtype
              },
              lineuniquekey: "",
              baseamount: 0,
              taxamount: 0,
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
              expenseacc: {},
              position: "",
              description: "",
              lc_baseamount: 0,
              lc_taxamount: 0,
              lc_grossamount: 0
            });
          }
        } // FIN FOR CONTRIBUTORY CLASS
      }
      else {
        for (var i = 0; i < NT_SearchResult.length; i++) {
          var NT_taxTypeID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxtype" });
  
          
          if (NT_taxTypeID == '3') {
  
            var NT_internalID = NT_SearchResult[i].getValue({ name: "internalid" });
            var NT_generatedTransaction = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_gen_transaction" });
            var NT_generatedTransactionID = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_gen_transaction" });
            var NT_taxType = NT_SearchResult[i].getText({ name: "custrecord_lmry_ntax_taxtype" });
            var NT_taxRate = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxrate" });
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
            taxInformation[NT_internalID] = [NT_taxItem, NT_taxCode];
  
            taxResults.push({
              taxtype: {
                text: NT_taxType,
                value: NT_taxTypeID
              },
              subtype: {
                text: NT_subtype,
                value:  NT_subtypeID
              },
              lineuniquekey: "",
              baseamount: 0,
              taxamount: 0,
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
                text: "",
                value: ""
              },
              expenseacc: {},
              position: "",
              description: "",
              lc_baseamount: 0,
              lc_taxamount: 0,
              lc_grossamount: 0
            });
          }
        } // FIN FOR NATIONAL TAX
      }
    }
    catch(error) {
      Library_Mail.sendemail( "[ setDetractions ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ setDetractions ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * FUNCION PARA ELIMINAR EL TAX RESULT RELACIONADO A LA TRANSACCION
  * DESPUES DE QUE ESTA HAYA SIDO ELIMINADA
  *    - recordObj: Registro de la transaccion
  ***************************************************************************/
  function cleanLinesforCopy(recordObj) {
    try {
      var numLineas = recordObj.getLineCount({
        sublistId: "item",
      });

      recordObj.setValue({
        fieldId: "custbody_lmry_informacion_adicional",
        value: "",
      });
      
      for (var i = 0; i < numLineas; i++) {
        var amountItem = recordObj.getSublistValue({
          sublistId: "item",
          fieldId: "amount",
          line: i,
        });
        recordObj.setSublistValue("item", "taxamount", i, 0);
        recordObj.setSublistValue("item", "grossamt", i, amountItem);  
      }
      
      var taxDetailsLines = recordObj.getLineCount({
        sublistId: "taxdetails",
      });  
      if(taxDetailsLines > 0){
        for (var j = 0; j < taxDetailsLines; j++) {
          recordObj.removeLine({ sublistId: "taxdetails", line: 0 });
        }
      }
    } catch (error) {
      Library_Mail.sendemail( "[ beforeLoad - cleanLinesforCopy ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ beforeLoad - cleanLinesforCopy ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * FUNCION PARA ELIMINAR EL TAX RESULT RELACIONADO A LA TRANSACCION
  * DESPUES DE QUE ESTA HAYA SIDO ELIMINADA
  *    - transaction: Transaccion
  ***************************************************************************/
  function deleteTaxResult(transaction) {
    try {
      var resSearch = search.create({
          type: "customrecord_lmry_latamtax_tax_result",
          columns: ["id"],
          filters: [
            "custrecord_lmry_tr_related_transaction",
            "is",
            transaction,
          ]
      }).run().getRange({ start: 0, end: 10 });

      if (resSearch != null && resSearch.length > 0) {
        var recordId = resSearch[0].getValue("id");
        record.delete({
          type: "customrecord_lmry_latamtax_tax_result",
          id: recordId,
        });
      }
    } catch (error) {
      Library_Mail.sendemail( "[ beforeSubmit - deleteTaxResult ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ beforeSubmit - deleteTaxResult ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
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

  function round2(amount) {
    return parseFloat(Math.round(parseFloat(amount) * 1e2 + 1e-14) / 1e2);
  }

  

  
  return {
    setTaxTransaction: setTaxTransaction,
    cleanLinesforCopy: cleanLinesforCopy,
    deleteTaxResult: deleteTaxResult,
  };
});
