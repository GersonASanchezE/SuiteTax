/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_MX_ST_WHT_Tax_Sales_Transaction_LBRY_V2.0.js||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 20 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

 define(["N/log", "N/format", "N/record", "N/search", "N/runtime", "./LMRY_libSendingEmailsLBRY_V2.0", './LMRY_Log_LBRY_V2.0'
],
function (log, format, record, search, runtime, Library_Mail, Library_Log) {
  var LMRY_SCRIPT = "LatamReady - MX ST WHT Sales Transaction LBRY";
  var LMRY_SCRIPT_NAME = 'LMRY_MX_ST_WHT_Tax_Sales_Transaction_LBRY_V2.0.js';

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
  var FEATURE_SUBSIDIARY = false;
  var FEATURE_MULTIBOOK = false;
  var MEMO_TRANSACTION = '(LatamTax -  WHT)';
  var MEMO_LINE = ' (LatamTax - WHT) ';
  var WHT_MEMO = 'Latam - WHT Tax';

  var exchangeRate = 0;
  
  /*********************************************************************************************************
   * Funcion que realiza el calculo de los impuestos.
   * Para Peru: Llamada desde el User Event del Invoice, Credit Memo.
   ********************************************************************************************************/
  function setWHTTransaction(scriptContext, licenses) {
    try {
      var recordObj = scriptContext.newRecord;
      var type = scriptContext.type;

      if (type == "create" || type == "edit" || type == "copy") {
        var recordId = "";
        var transactionType = "";

        recordId = scriptContext.newRecord.id;
        transactionType = scriptContext.newRecord.type;

        var override = recordObj.getValue({fieldId: "taxdetailsoverride"});
        var appliedWHT = recordObj.getValue({fieldId: "custbody_lmry_apply_wht_code"});
        if (override == true || override == "T" && appliedWHT == true || appliedWHT == "T") {

          FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});
          FEATURE_MULTIBOOK = runtime.isFeatureInEffect({feature: "MULTIBOOK"});
          
          var subsidiary;
          if (FEATURE_SUBSIDIARY) {
            subsidiary = recordObj.getValue({fieldId: "subsidiary"});
          } else {
            subsidiary = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country",});
          }
          
          var transactionDate = recordObj.getText({fieldId: "trandate"});
          var idCountry = recordObj.getValue({fieldId: "custbody_lmry_subsidiary_country"});
          var transactionEntity = recordObj.getValue({fieldId: "entity"});
          var transactionDocumentType = recordObj.getValue({fieldId: 'custbody_lmry_document_type'});
          
          var filtroTransactionType;
          switch (transactionType) {
            case "invoice":
              filtroTransactionType = 1;
              break;
            case "creditmemo":
              filtroTransactionType = 8;
              break;
            default:
              return recordObj;
          }
                 
          var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
          exchangeRate = getExchangeRate(recordObj, subsidiary, setupSubsidiary);
          
          var setupTaxSubsiRounding = setupSubsidiary["rounding"]; 
          
          var itemLineCount = recordObj.getLineCount({sublistId: 'item'});
          
          var taxResults = [];
          var taxInformation = {};
          var flagCC = false; 
          
          if (itemLineCount != "" && itemLineCount != 0) {
            var CC_SearchResult = getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, transactionEntity, transactionDocumentType);
            if (CC_SearchResult != null && CC_SearchResult.length > 0){
              flagCC = true;
              // setTaxes(recordObj, CC_SearchResult, [], taxResults);
              setWHTTax(recordObj, taxResults, CC_SearchResult, [], flagCC, taxInformation);
            }
            else {
              var NT_SearchResult = getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, transactionDocumentType);
              if (NT_SearchResult != null && NT_SearchResult.length > 0) {
                // setTaxes(recordObj, [], NT_SearchResult, taxResults);
                setWHTTax(recordObj, taxResults, [], NT_SearchResult, flagCC, taxInformation);
              }
            }
          }

          var TResultTax = [];
          var TResultWHT = taxResults;
          
          log.error("TResultWHT", TResultWHT)

          //Actualizar TaxResults
          var approvalFeature = false;
          if(TResultWHT.length > 0) {
            if (FEATURE_TRANSACTION[transactionType]) {
              approvalFeature = runtime.getCurrentScript().getParameter({name: FEATURE_TRANSACTION[transactionType]});
            }

            var approvalStatus = 0;
            approvalStatus = recordObj.getValue({fieldId: 'approvalstatus'});

            if ((approvalFeature == false || approvalFeature == 'F') || ((approvalFeature == true || approvalFeature == 'T') && (approvalStatus && Number(approvalStatus) == 2))) {
              // log.error("taxInformation", taxInformation);
              // log.error("TResultWHT2", TResultWHT);
              createWHTTransaction(recordObj, TResultWHT, taxInformation, licenses, flagCC);
            } // Fin IF status
            
          }
          saveTaxResult(recordId, subsidiary, idCountry, TResultWHT);
                   
        } // Fin if taxdetailsoverride && appliedWht
      } // Fin If create, edit o copy
      return recordObj;
    } catch (error) {
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
  function setWHTTax(recordObj, taxResults, CC_SearchResult, NT_SearchResult, flagCC, taxInformation) {
    try {
      if(flagCC) {
        for (var i = 0; i < CC_SearchResult.length; i++) {
  
          var CC_internalID = CC_SearchResult[i].getValue({ name: "internalid" });
          var CC_taxRate = CC_SearchResult[i].getValue({ name: "custrecord_lmry_ar_ccl_taxrate" });
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

          taxInformation[CC_internalID] = [CC_taxItem, CC_taxCode];
          var WHTAmount = parseFloat(parseFloat(CC_taxRate) * amount_base) / exchangeRate;

          amount_base = amount_base / exchangeRate;

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
            lc_grossamount: (WHTAmount + amount_base) * exchangeRate
          });
          
        } // FIN FOR CONTRIBUTORY CLASS
      }
      else {
        for (var i = 0; i < NT_SearchResult.length; i++) {
          var NT_internalID = NT_SearchResult[i].getValue({ name: "internalid" });
          var NT_taxRate = NT_SearchResult[i].getValue({ name: "custrecord_lmry_ntax_taxrate" });
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

          taxInformation[NT_internalID] = [NT_taxItem, NT_taxCode];
          var WHTAmount = parseFloat(parseFloat(NT_taxRate) * amount_base) / exchangeRate;

          amount_base = amount_base / exchangeRate;

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
            lc_grossamount: (WHTAmount + amount_base) * exchangeRate
          });
          
        } // FIN FOR NATIONAL TAX
      }
    } 
    catch (error) {
      Library_Mail.sendemail( "[ setWHTTax ]: " + error, LMRY_SCRIPT );
      Library_Log.doLog({ title: "[ setWHTTax ]", message: error, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /******************************************************************************
  * FUNCION PARA GENERAR UN CREDIT MEMO SI HAY DETRACCIONES APLCIADOS AL INVOICE
  *    - recordObj: Registro de la transaccion
  *    - taxResults: Json donde se acumuló los Tax Result de tipo Detraccion
  *    - taxInformation: Informacion del CC o NT
  *    - licenses: Licencias
  *    - flagCC: Booleano para saber si se encontró CC
  ******************************************************************************/
  function createWHTTransaction(recordObj, taxResults, taxInformation, licenses, flagCC) {
    try{
      var recordType = recordObj.getValue('baserecordtype');
      var idTransaction = recordObj.id;
      var idNewRecord = null;
  
      if (CONFIG_TRANSACTION[recordType]) {
        var entity = recordObj.getValue('entity');
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
  
        var fromType = "invoice";
        var fromId = idTransaction;
        if (recordType == "creditmemo") {
          fromType = "customer";
          fromId = entity;
        }
        var toType = CONFIG_TRANSACTION[recordType]['recordtype'];
        
        var useGroupFeature = false;
        if (licenses) {
          useGroupFeature = Library_Mail.getAuthorization(381, licenses);
        }
        if(useGroupFeature){
          var groupTaxResults = taxResults.reduce(function(rv, x) {
            rv[x["subtype"]["value"]] = rv[x["subtype"]["value"]] || [];
            rv[x["subtype"]["value"]].push(x);
            return rv;
          }, {});
        }
        else{
          if(flagCC){
            var groupTaxResults = taxResults.reduce(function(rv, x) {
              rv[x["contributoryClass"]] = rv[x["contributoryClass"]] || [];
              rv[x["contributoryClass"]].push(x);
              return rv;
            }, {});
          }
          else{
            var groupTaxResults = taxResults.reduce(function(rv, x) {
              rv[x["nationalTax"]] = rv[x["nationalTax"]] || [];
              rv[x["nationalTax"]].push(x);
              return rv;
            }, {});
          }
        }
        var arrayKeys = Object.keys(groupTaxResults);
        
        var TOTAL_AMOUNT_WHT = 0.0;

        for (var k = 0; k < arrayKeys.length; k++) {
          var taxResults_array = groupTaxResults[arrayKeys[k]];

          var recordTransaction = record.transform({
            fromType: fromType,
            fromId: fromId,
            toType: toType,
            isDynamic: false
          });

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
  
          //Limpiar campos copiados del invoice
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

          if (toType == "creditmemo") {
            //si se genera un creditmemo se elimina los items que viene del invoice
            removeAllItems(recordTransaction);
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
            
            amountWHT += taxResult["whtamount"];

            recordTransaction.insertLine({sublistId: 'item',line: i});
            recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'item', value: taxItem, line: i});
            recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'rate', value: taxResult["whtamount"], line: i});
            recordTransaction.setSublistValue({sublistId: 'item', fieldId: 'amount', value: taxResult["whtamount"], line: i});
      
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

          if (toType == "creditmemo") {
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
          //log.error("idNewRecord", idNewRecord);
  
          idNewRecord = setTaxDetailWHTTransaction(recordObj, idNewRecord, taxResults_array, taxCode, taxType);
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

  /*******************************************************************************
  * FUNCION PARA SETEAR EN EL TAX DETAIL DEL CREDIT MEMO GENERADO
  *    - invoiceObj: Registro de la transaccion
  *    - creditMemoId: ID del Credit Memo generado
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
  function saveTaxResult(transaction, subsidiary, country, TResultWth) {
    try {
      var resultSearchTR = search.create({
          type: "customrecord_lmry_latamtax_tax_result",
          columns: ["internalid"],
          filters: ["custrecord_lmry_tr_related_transaction","is",transaction],
        }).run().getRange({ start: 0, end: 10 });

      if (resultSearchTR != null && resultSearchTR.length > 0) {
        var recordId = resultSearchTR[0].getValue("internalid");

        record.submitFields({
          type: "customrecord_lmry_latamtax_tax_result",
          id: recordId,
          values: {
            custrecord_lmry_tr_subsidiary: subsidiary,
            custrecord_lmry_tr_country: country,
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
          fieldId: "custrecord_lmry_tr_wht_transaction",
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
          "custrecord_lmry_ar_ccl_taxrate",
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
          "custrecord_lmry_ccl_minamount"
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
          "custrecord_lmry_ntax_taxrate",
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
  };
});


