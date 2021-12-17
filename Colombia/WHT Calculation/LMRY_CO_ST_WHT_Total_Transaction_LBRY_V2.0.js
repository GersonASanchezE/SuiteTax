/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ST_CO_WHT_Total_Transaction_LBRY_V2.0.js	||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 25 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/log', 'N/record', 'N/search', 'N/runtime', 'N/format',
        './LMRY_libSendingEmailsLBRY_V2.0', './LMRY_libNumberInWordsLBRY_V2.0'],

  function(log, record, search, runtime, format, Library_Mail, Library_Number) {

    var LMRY_SCRIPT = "LMRY ST CO WHT Total Transaction LBRY V2.0";
    var WHT_MEMO = "Latam - WHT";
    var GENERATED_TRANSACTION = {
      invoice: "creditmemo",
      vendorbill: "vendorcredit",
      creditmemo: "invoice",
      vendorcredit: "vendorbill"
    };

    /***************************************************************************
     * Funcion para crear las transacciones de a cuerdo al tipo de trasaccion
     *    - transactionType: Tipo de transacion (invoice, credit memo, bill, bill credit)
     *    - transactionID: ID de la transaccion
     ***************************************************************************/
    function setWHTTotalTransaction( transactionType, transactionID ) {

      try {

        // Delete Journal Entry
        deleteJournalEntry( transactionID );

        switch ( transactionType ) {
          case "invoice": // Delete Credit Memo
            deleteTransactionByType( "creditmemo", transactionID );
            break;
          case "vendorbill": // Delete Vendor Credit
            deleteTransactionByType( "vendorcredit", transactionID );
            break;
        }

        var whtAmount = 0;

        var recordObj = record.load({
          type: transactionType,
          id: transactionID
        });

        var applyWHT = recordObj.getValue({ fieldId: "custbody_lmry_apply_wht_code" });
        if( applyWHT == false || applyWHT == "F" ) {
          applyWHT = null;
          return true;
        }

        var RETEICA = recordObj.getValue({ fieldId: "custbody_lmry_co_reteica" });
        whtAmount += parseFloat( getWhtAmountByWHT(transactionType, transactionID, recordObj, RETEICA) );

        var RETEIVA = recordObj.getValue({ fieldId: "custbody_lmry_co_reteiva" });
        whtAmount += parseFloat( getWhtAmountByWHT(transactionType, transactionID, recordObj, RETEIVA) );

        var RETEFTE = recordObj.getValue({ fieldId: "custbody_lmry_co_retefte" });
        whtAmount += parseFloat( getWhtAmountByWHT(transactionType, transactionID, recordObj, RETEFTE) );

        var RETECREE = recordObj.getValue({ fieldId: "custbody_lmry_co_autoretecree" });
        getWhtAmountByWHT( transactionType, transactionID, recordObj, RETECREE );

        // MONTO TOTAL DE LA TRANSACCION TRANSCRITO EN LETRAS
        if( transactionType == "invoice" || transactionType == "creditmemo" ) {

          var currency = search.lookupFields({
            type: search.Type.CURRENCY,
            id: recordObj.getValue({ fieldId: "currency" }),
            columns: ["name"]
          });

          var totalAmount = recordObj.getValue({ fieldId: "total" });
          totalAmount = parseFloat( totalAmount ) - parseFloat( whtAmount );

          var textAmount = Library_Number.ConvNumeroLetraESP( totalAmount, currency.name, "", "Y" );
          record.submitFields({
            type: transactionType,
            id: transactionID,
            values: {
              "custbody_lmry_pa_monto_letras": textAmount
            },
            options: {
              enableSourcing: true,
              ignoreMandatoryFields: true,
              disableTriggers: true
            }
          });

        }

        if( transactionType == "invoice" || transactionType == "vendorbill" ) {
          Create_WHT_1( transactionID, recordObj, RETEICA );
          Create_WHT_1( transactionID, recordObj, RETEIVA );
          Create_WHT_1( transactionID, recordObj, RETEFTE );
          Create_WHT_1( transactionID, recordObj, RETECREE );
        }

        if( transactionType == "creditmemo" || transactionType == "vendorcredit" ) {

          var transactionToUnApply = getTransactionsToApply( transactionID, GENERATED_TRANSACTION[transactionType] );
          log.debug('[ transactionToUnApply ]', transactionToUnApply);
          var applyArray = [];
          applyArray.push( Create_WHT_2(transactionID, recordObj, RETEICA) );
          applyArray.push( Create_WHT_2(transactionID, recordObj, RETEIVA) );
          applyArray.push( Create_WHT_2(transactionID, recordObj, RETEFTE) );
          applyArray.push( Create_WHT_2(transactionID, recordObj, RETECREE) );
          log.debug( "[ applyArray ]", applyArray );
          applyToTransactions( transactionID, transactionType, applyArray, transactionToUnApply );

        }

      } catch (e) {
        Library_Mail.sendemail( "setWHTTotalTransaction - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para crear las notas de crédito o journal de acuerdo al tipo de
     * transaccion (Invoice o Vendor Bill)
     *    - transactionID: ID de la transaccion
     *    - recordObj: Transaccion
     *    - WHT_ID: Withholding Tax
     ***************************************************************************/
    function Create_WHT_1( transactionID, recordObj, WHT_ID ) {

      try {

        if( WHT_ID == null || WHT_ID == "" ) {
          return true;
        }

        var exchangeRate = getExchangeRate( recordObj );
        var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
        var transactionEntity = recordObj.getValue({ fieldId: "entity" });
        var STS_Json = getTaxCodeFromSetupSubsidiary( transactionSubsidiary );

        var WHT_Search = search.load({ id: "customsearch_lmry_wht_base" });
        WHT_Search.filters.push( search.createFilter({
          name: "internalid",
          operator: search.Operator.ANYOF,
          values: [WHT_ID]
        }) );
        var WHT_SearchResult = WHT_Search.run().getRange(0, 10);

        if( WHT_SearchResult != null && WHT_SearchResult.length > 0 ) {

          var WHT_Columns = WHT_SearchResult[0].columns;
          var transactionType = recordObj.getValue({ fieldId: "type" });

          var WHT_Transaction1 = "";
          var WHT_Transaction2 = "";
          var WHT_CustomForm = "";
          var WHT_Name = WHT_SearchResult[0].getValue("name");
          var WHT_AvailableOn = "";
          var WHT_Point = "";
          var WHT_Item = "";
          var WHT_Kind = WHT_SearchResult[0].getValue("custrecord_lmry_wht_kind");
          var WHT_Rate = WHT_SearchResult[0].getValue("custrecord_lmry_wht_coderate");
          var WHT_DateFrom = WHT_SearchResult[0].getValue(WHT_Columns[6]);
          var WHT_DateUntil = WHT_SearchResult[0].getValue(WHT_Columns[7]);
          var WHT_MinAmount = WHT_SearchResult[0].getValue("custrecord_lmry_wht_codeminbase") || 0;
          var WHT_CreditAcc = WHT_SearchResult[0].getValue("custrecord_lmry_wht_taxcredacc");
          var WHT_LiabilityAcc = WHT_SearchResult[0].getValue("custrecord_lmry_wht_taxliabacc");
          var WHT_CustomField = WHT_SearchResult[0].getValue(WHT_Columns[4]);
          var WHT_Base = "";

          // VARIABLES PARA VENTAS
          if( transactionType == "custinvc" ) {
            WHT_Transaction1 = "invoice";
            WHT_Transaction2 = "creditmemo";
            WHT_CustomForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_credit_memo" });
            WHT_AvailableOn = WHT_SearchResult[0].getValue("custrecord_lmry_wht_onsales");
            WHT_Point = WHT_SearchResult[0].getValue("custrecord_lmry_wht_saletaxpoint");
            WHT_Item = WHT_SearchResult[0].getValue("custrecord_lmry_wht_taxitem_sales");
            WHT_Base = WHT_SearchResult[0].getValue(WHT_Columns[12]);
          }

          // VARIABLES PARA COMPRAS
          if( transactionType == "vendbill" ) {
            WHT_Transaction1 = "vendorbill";
            WHT_Transaction2 = "vendorcredit";
            WHT_CustomForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_vendor_credit" });
            WHT_AvailableOn = WHT_SearchResult[0].getValue("custrecord_lmry_wht_onpurchases");
            WHT_Point = WHT_SearchResult[0].getValue("custrecord_lmry_wht_purctaxpoint");
            WHT_Item = WHT_SearchResult[0].getValue("custrecord_lmry_wht_taxitem_purchase");
            WHT_Base = WHT_SearchResult[0].getValue(WHT_Columns[16]);
          }

          if( (WHT_Base == "" || WHT_Base == null) || (WHT_AvailableOn == false || WHT_AvailableOn == "F") ){
            return true;
          }

          var baseAmount = 0;
          if( WHT_Base == "subtotal" && transactionType == "vendbill" ) {
            var totalAmount = parseFloat( recordObj.getValue({ fieldId: "total" }) );
            var taxAmount = parseFloat( recordObj.getValue({ fieldId: "taxtotal" }) );
            baseAmount = parseFloat( totalAmount - taxAmount );
          } else {
            baseAmount = parseFloat( recordObj.getValue({ fieldId: WHT_Base }) );
          }

          var whtAmount = 0;
          if( baseAmount != "" && baseAmount != null ) {
            whtAmount = baseAmount * parseFloat( WHT_Rate / 100 );
            whtAmount = round2(whtAmount);
            whtAmount = Math.abs( whtAmount );
          }

          var transactionDate = getFormatDate( recordObj.getValue({ fieldId: "trandate" }) );

          if( WHT_Point == 1 ) {

            if( (WHT_DateFrom != null && WHT_DateFrom != "") && (WHT_DateUntil != null && WHT_DateUntil != "") &&
                (WHT_DateFrom <= transactionDate && transactionDate <= WHT_DateUntil) &&
                ((baseAmount * exchangeRate) >= WHT_MinAmount) && ((baseAmount * exchangeRate) > 0) &&
                (whtAmount > 0) ) {

              // VALIDACION PARA CREAR UNA NOTA DE CREDITO O UN JOURNAL
              if( WHT_Kind == 1 ) {

                if( WHT_Item == null || WHT_Item == "" ) {
                  return true;
                }

                var newRecord = record.create({
                  type: WHT_Transaction2
                });

                // FORMULARIO PERSONALIZADO
                if( WHT_CustomForm != null && WHT_CustomForm != "" ) {
                  newRecord.setValue({ fieldId: "customform", value: WHT_CustomForm });
                }

                // CAMPOS ESTANDAR DE NETSUITE
                newRecord.setValue({ fieldId: "entity", value: transactionEntity });
                newRecord.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });

                var transactionAccount = recordObj.getValue({ fieldId: "account" });
                newRecord.setValue({ fieldId: "account", value: transactionAccount });

                if( WHT_Name != null && WHT_Name != "" ) {
                  newRecord.setValue({ fieldId: "memo", value: "Latam - WHT " + WHT_Name });
                }

                newRecord.setValue({ fieldId: "tranid", value: "LTMP - " + transactionID });

                var transactionDate = recordObj.getValue({ fieldId: "trandate" });
                transactionDate = format.parse({
                  value: transactionDate,
                  type: format.Type.DATE
                });
                newRecord.setValue({ fieldId: "trandate", value: transactionDate });

                var transactionPeriod = recordObj.getValue({ fieldId: "postingperiod" });
                newRecord.setValue({ fieldId: "postingperiod", value: transactionPeriod });

                var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
                newRecord.setValue({ fieldId: "currency", value: transactionCurrency });

                newRecord.setValue({ fieldId: "exchangerate", value: exchangeRate });

                var salesRep = recordObj.getValue({ fieldId: "salesrep" });
                if( salesRep != null && salesRep != "" ) {
                  var employeeSearch = search.lookupFields({
                    type: "employee",
                    id: salesRep,
                    columns: [ "isinactive", "issalesrep" ]
                  });
                  if( (employeeSearch.isinactive == false || employeeSearch.isinactive == "F") &&
                      (employeeSearch.issalesrep == true && employeeSearch.issalesrep == "T") ) {
                    newRecord.setValue({ fieldId: "salesrep", value: salesRep });
                  }
                }

                // SEGMENTACION
                var transactionDepartment = recordObj.getValue({ fieldId: "department" });
                if( transactionDepartment != null && transactionDepartment != "" ) {
                  newRecord.setValue({ fieldId: "department", value: transactionDepartment });
                }

                var transactionClass = recordObj.getValue({ fieldId: "class" });
                if( transactionClass != null && transactionClass != "" ) {
                  newRecord.setValue({ fieldId: "class", value: transactionClass });
                }

                var transactionLocation = recordObj.getValue({ fieldId: "location" });
                if( transactionLocation != null && transactionLocation != "" ) {
                  newRecord.setValue({ fieldId: "location", value: transactionLocation });
                }

                // SUB TAB TAX DETAILS
                newRecord.setValue({ fieldId: "taxdetailsoverride", value: true });
                newRecord.setValue({ fieldId: "taxregoverride", value: true });
                newRecord.setValue({ fieldId: "taxpointdateoverride", value: true });

                var transactionNexus = recordObj.getValue({ fieldId: "nexus" });
                newRecord.setValue({ fieldId: "nexus", value: transactionNexus });

                var transactionTaxType = recordObj.getValue({ fieldId: "custbody_ste_transaction_type" });
                if( transactionTaxType != null && transactionTaxType != "" ) {
                  newRecord.setValue({ fieldId: "custbody_ste_transaction_type", value: transactionTaxType });
                }

                var transactionSubsiTaxRegNumber = recordObj.getValue({ fieldId: "subsidiarytaxregnum" });
                newRecord.setValue({ fieldId: "subsidiarytaxregnum", value: transactionSubsiTaxRegNumber });

                var transactionEntityTaxRegNumber = recordObj.getValue({ fieldId: "entitytaxregnum" });
                newRecord.setValue({ fieldId: "entitytaxregnum", value: transactionEntityTaxRegNumber });

                var transactionTaxPointDate = recordObj.getValue({ fieldId: "taxpointdate" });
                transactionTaxPointDate = format.parse({
                  value: transactionTaxPointDate,
                  type: format.Type.DATE
                });
                newRecord.setValue({ fieldId: "taxpointdate", value: transactionTaxPointDate });

                // SEGMENTACION LINEAL
                if( transactionDepartment == null || transactionDepartment == "" ) {
                  transactionDepartment = recordObj.getSublistValue({ sublistId: "item", fieldId: "deparment", line: 0 });
                }
                if( transactionClass == null || transactionClass == "" ) {
                  transactionClass = recordObj.getSublistValue({ sublistId: "item", fieldId: "class", line: 0 });
                }
                if( transactionLocation == null || transactionLocation == "" ) {
                  transactionLocation = recordObj.getSublistValue({ sublistId: "item", fieldId: "location", line: 0 });
                }

                newRecord.setValue({ fieldId: "custbody_lmry_apply_wht_code", value: false });
                // CAMPOS DE LOS TIPOS DE RETENCION
                newRecord.setValue({ fieldId: "custbody_lmry_co_reteica", value: "" });
                newRecord.setValue({ fieldId: "custbody_lmry_co_reteiva", value: "" });
                newRecord.setValue({ fieldId: "custbody_lmry_co_retefte", value: "" });
                newRecord.setValue({ fieldId: "custbody_lmry_co_autoretecree", value: "" });
                // CAMPOS PARA LOS IMPORTES DE RETENCION
                newRecord.setValue({ fieldId: "custbody_lmry_co_reteica_amount", value: 0 });
                newRecord.setValue({ fieldId: "custbody_lmry_co_reteiva_amount", value: 0 });
                newRecord.setValue({ fieldId: "custbody_lmry_co_retefte_amount", value: 0 });
                newRecord.setValue({ fieldId: "custbody_lmry_co_retecree_amount", value: 0 });
                // ACTUALIZA EL CAMPO TRANSACCION DE REFERENCIA
                newRecord.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
                newRecord.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });

                newRecord.setValue({ fieldId: "custbody_lmry_wht_base_amount", value: baseAmount });

                if( WHT_Item != null && WHT_Item != "" ) {

                  newRecord.setSublistValue({ sublistId: "item", fieldId: "item", line: 0, value: WHT_Item });
                  newRecord.setSublistValue({ sublistId: "item", fieldId: "item", line: 0, value: WHT_Item });
                  newRecord.setSublistValue({ sublistId: "item", fieldId: "price", line: 0, value: -1 });

                  if( whtAmount != null && whtAmount != "" ) {
                    newRecord.setSublistValue({ sublistId: "item", fieldId: "rate", line: 0, value: whtAmount });
                  }

                  if( transactionDepartment != null && transactionDepartment != "" ) {
                    newRecord.setSublistValue({ sublistId: "item", fieldId: "deparment", line: 0, value: transactionDepartment });
                  }
                  if( transactionClass != null && transactionClass != "" ) {
                    newRecord.setSublistValue({ sublistId: "item", fieldId: "class", line: 0, value: transactionClass });
                  }
                  if( transactionLocation != null && transactionLocation != "" ) {
                    newRecord.setSublistValue({ sublistId: "item", fieldId: "location", line: 0, value: transactionLocation });
                  }

                  newRecord.setSublistValue({ sublistId: "item", fieldId: "custcol_lmry_base_amount", line: 0, value: whtAmount });

                  var newRecordID = newRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                  });

                  /************************************
                   * Abre el Credit Memo para aplicar
                   * a la transaccion que se le genero
                   * la retencion.
                   ***********************************/
                  var applyRecord = record.load({
                    type: WHT_Transaction2,
                    id: newRecordID
                  });

                  // Llena línea del Tax Detail
                  var recordLineCount = applyRecord.getLineCount({ sublistId: "item" });
                  if( recordLineCount > 0 ) {
                    for( var i = 0; i < recordLineCount; i++ ) {
                      var recordDetailReference = applyRecord.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: i });
                      if( recordDetailReference != null || recordDetailReference != "" ) {
                        applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: i, value: recordDetailReference });
                        applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: i, value: STS_Json.taxtype });
                        applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: i, value: STS_Json.taxcode });
                        applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: i, value: whtAmount });
                        applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: i, value: 0.0 });
                        applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: i, value: 0.0 });
                      }
                    }
                  }

                  // Detalles de transacciones aplicadas
                  var applyLineCount = applyRecord.getLineCount({ sublistId: "apply" });
                  if( applyLineCount > 0 ) {
                    for( var i = 0; i < applyLineCount; i++ ) {
                      var applyTransaction = applyRecord.getSublistValue({ sublistId: "apply", fieldId: "apply", line: i });
                      if( applyTransaction == true || applyTransaction == "T" ) {
                        applyRecord.setSublistValue({ sublistId: "apply", fieldId: "apply", line: i, value: false });
                      }
                    }
                  }

                  for( var i = 0; i < applyLineCount; i++ ) {
                    var applyTransactionID = applyRecord.getSublistValue({ sublistId: "apply", fieldId: "internalid", line: i });
                    if( transactionID == applyTransactionID ) {
                      var applyTransaction = applyRecord.getSublistValue({ sublistId: "apply", fieldId: "apply", line: i });
                      if( applyTransaction == false || applyTransaction == "F" ) {
                        applyRecord.setSublistValue({ sublistId: "apply", fieldId: "apply", line: i, value: true });
                      }
                      applyRecord.setSublistValue({ sublistId: "apply", fieldId: "amount", line: i, value: whtAmount });
                      break;
                    }
                  }

                  var newRecordID = applyRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                  });

                  record.submitFields({
                    type: WHT_Transaction2,
                    id: newRecordID,
                    values: {
                      "tranid": "LWHT " + newRecordID,
                      "account": transactionAccount
                    },
                    option: {
                      enableSourcing: true,
                      ignoreMandatoryFields: true,
                      disableTriggers: true
                    }
                  });

                }

              } else if( WHT_Kind == 2 ) {

                var newJournalEntry = record.create({
                  type: record.Type.JOURNAL_ENTRY,
                  isDynamic: true
                });

                WHT_CustomForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_journal_entry" });
                if( WHT_CustomForm != null && WHT_CustomForm != "" ) {
                  newJournalEntry.setValue({ fieldId: "customform", value: WHT_CustomForm });
                }

                // Campos estandar de NetSuite
                newJournalEntry.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });

                var transactionDate = recordObj.getValue({ fieldId: "trandate" });
                newJournalEntry.setValue({ fieldId: "trandate", value: transactionDate });

                var transactionPeriod = recordObj.getValue({ fieldId: "postingperiod" });
                newJournalEntry.setValue({ fieldId: "postingperiod", value: transactionPeriod });

                var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
                newJournalEntry.setValue({ fieldId: "currency", value: transactionCurrency });

                newJournalEntry.setValue({ fieldId: "exchangerate", value: exchangeRate });
                newJournalEntry.setValue({ fieldId: "memo", value: "Latam - WHT " + WHT_Name });

                // var transactionNexus = recordObj.getValue({ fieldId: "nexus" });
                // newJournalEntry.setValue({ fieldId: "nexus", value: transactionNexus });
                //
                // var transactionTaxType = recordObj.getValue({ fieldId: "custbody_ste_transaction_type" });
                // if( transactionTaxType != null && transactionTaxType != "" ) {
                //   newJournalEntry.setValue({ fieldId: "custbody_ste_transaction_type", value: transactionTaxType });
                // }
                //
                // var transactionSubsiTaxRegNumber = recordObj.getValue({ fieldId: "subsidiarytaxregnum" });
                // newJournalEntry.setValue({ fieldId: "subsidiarytaxregnum", value: transactionSubsiTaxRegNumber });

                // Segmentacion
                var transactionDepartment = recordObj.getValue({ fieldId: "department" });
                if( transactionDepartment != null && transactionDepartment != "" ) {
                  newJournalEntry.setValue({ fieldId: "deparment", value: transactionDepartment });
                } else {
                  transactionDepartment = recordObj.getSublistValue({ sublistId: "item", fieldId: "department", line: 0 });
                }

                var transactionClass = recordObj.getValue({ fieldId: "class" });
                if( transactionClass != null && transactionClass != "" ) {
                  newJournalEntry.setValue({ fieldId: "class", value: transactionClass });
                } else {
                  transactionClass = recordObj.getSublistValue({ sublistId: "item", fieldId: "class", line: 0 });
                }

                var transactionLocation = recordObj.getValue({ fieldId: "location" });
                if( transactionLocation != null && transactionLocation != "" ) {
                  newJournalEntry.setValue({ fieldId: "location", value: transactionLocation });
                } else{
                  transactionLocation = recordObj.getSublistValue({ sublistId: "location", fieldId: "location", line: 0 });
                }

                // Campos LatamReady
                newJournalEntry.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
                newJournalEntry.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });
                newJournalEntry.setValue({ fieldId: "custbody_lmry_reference_entity", value: transactionEntity});

                // Linea de Debito
                newJournalEntry.selectNewLine({ sublistId: "line" });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: WHT_CreditAcc });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "debit", value: whtAmount });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: "Latam - WHT " + WHT_Name });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "deparment", value: transactionDepartment });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: transactionClass });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: transactionLocation });
                newJournalEntry.commitLine({ sublistId: "line" });

                // Linea de Credito
                newJournalEntry.selectNewLine({ sublistId: "line" });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: WHT_LiabilityAcc });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "credit", value: whtAmount });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: "Latam - WHT " + WHT_Name });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "deparment", value: transactionDepartment });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: transactionClass });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: transactionLocation });
                newJournalEntry.commitLine({ sublistId: "line" });

                newJournalEntry.save({
                  enableSourcing: true,
                  ignoreMandatoryFields: true,
                  disableTriggers: true
                });

              }

            }

          }

        }

      } catch (e) {
        Library_Mail.sendemail( "Create_WHT_1 - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para crear las transacciones o journal de acuerdo al tipo de
     * nota de credito (Credit Memo o Vendor Credit)
     *    - transactionID: ID de la transaccion
     *    - recordObj: Transaccion
     *    - WHT_ID: Withholding Tax
     ***************************************************************************/
    function Create_WHT_2( transactionID, recordObj, WHT_ID ) {

      try {

        var newRecord = 0;
        if( WHT_ID == null || WHT_ID == "" ) {
          return newRecord;
        }

        var exchangeRate = getExchangeRate( recordObj );
        var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });
        var transactionEntity = recordObj.getValue({ fieldId: "entity" });
        var STS_Json = getTaxCodeFromSetupSubsidiary( transactionSubsidiary );

        var WHT_Search = search.load({ id: "customsearch_lmry_wht_base" });
        WHT_Search.filters.push( search.createFilter({
          name: "internalid",
          operator: search.Operator.ANYOF,
          values: [WHT_ID]
        }) );
        var WHT_SearchResult = WHT_Search.run().getRange(0, 10);

        if( WHT_SearchResult != null && WHT_SearchResult.length > 0 ) {

          var WHT_Columns = WHT_SearchResult[0].columns;
          var transactionType = recordObj.getValue({ fieldId: "type" });

          var WHT_Transaction = "";
          var WHT_CustomForm = "";
          var WHT_Name = WHT_SearchResult[0].getValue("name");
          var WHT_AvailableOn = "";
          var WHT_Point = "";
          var WHT_Item = "";
          var WHT_Kind = WHT_SearchResult[0].getValue("custrecord_lmry_wht_kind");
          var WHT_Rate = WHT_SearchResult[0].getValue("custrecord_lmry_wht_coderate");
          var WHT_DateFrom = WHT_SearchResult[0].getValue(WHT_Columns[6]);
          var WHT_DateUntil = WHT_SearchResult[0].getValue(WHT_Columns[7]);
          var WHT_MinAmount = WHT_SearchResult[0].getValue("custrecord_lmry_wht_codeminbase") || 0;
          var WHT_CreditAcc = WHT_SearchResult[0].getValue("custrecord_lmry_wht_taxcredacc");
          var WHT_LiabilityAcc = WHT_SearchResult[0].getValue("custrecord_lmry_wht_taxliabacc");
          var WHT_CustomField = WHT_SearchResult[0].getValue(WHT_Columns[4]);
          var WHT_Base = "";

          // VARIABLES PARA VENTAS
          if( transactionType == "custcred" ) {
            WHT_Transaction = "invoice";
            WHT_CustomForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_invoice" });
            WHT_AvailableOn = WHT_SearchResult[0].getValue("custrecord_lmry_wht_onsales");
            WHT_Point = WHT_SearchResult[0].getValue("custrecord_lmry_wht_saletaxpoint");
            WHT_Item = WHT_SearchResult[0].getValue("custrecord_lmry_wht_taxitem_sales");
            WHT_Base = WHT_SearchResult[0].getValue(WHT_Columns[12]);
          }

          // VARIABLES PARA COMPRAS
          if( transactionType == "vendcred" ) {
            WHT_Transaction = "vendorbill";
            WHT_CustomForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_vendor_bill" });
            WHT_AvailableOn = WHT_SearchResult[0].getValue("custrecord_lmry_wht_onpurchases");
            WHT_Point = WHT_SearchResult[0].getValue("custrecord_lmry_wht_purctaxpoint");
            WHT_Item = WHT_SearchResult[0].getValue("custrecord_lmry_wht_taxitem_purchase");
            WHT_Base = WHT_SearchResult[0].getValue(WHT_Columns[16]);
          }

          if( (WHT_Base == "" || WHT_Base == null) || (WHT_AvailableOn == false || WHT_AvailableOn == "F") ){
            return newRecord;
          }

          var baseAmount = 0;
          if( WHT_Base == "subtotal" && transactionType == "vendcred" ) {
            var totalAmount = parseFloat( recordObj.getValue({ fieldId: "total" }) );
            var taxAmount = parseFloat( recordObj.getValue({ fieldId: "taxtotal" }) );
            baseAmount = parseFloat( totalAmount - taxAmount );
          } else {
            baseAmount = parseFloat( recordObj.getValue({ fieldId: WHT_Base }) );
          }

          var whtAmount = 0;
          if( baseAmount != "" && baseAmount != null ) {
            whtAmount = baseAmount * parseFloat( WHT_Rate / 100 );
            whtAmount = round2(whtAmount);
            whtAmount = Math.abs( whtAmount );
          }

          var transactionDate = getFormatDate( recordObj.getValue({ fieldId: "trandate" }) );

          if( WHT_Point == 1 ) {

            if( (WHT_DateFrom != null && WHT_DateFrom != "") && (WHT_DateUntil != null && WHT_DateUntil != "") &&
                (WHT_DateFrom <= transactionDate && transactionDate <= WHT_DateUntil) &&
                ((baseAmount * exchangeRate) >= WHT_MinAmount) && ((baseAmount * exchangeRate) > 0) &&
                (whtAmount > 0) ) {

              if( WHT_Kind == 1 ) {

                var newTransaction = record.create({
                  type: WHT_Transaction
                });

                if( WHT_CustomForm != null && WHT_CustomForm != "" ){
                  newTransaction.setValue({ fieldId: "customform", value: WHT_CustomForm });
                }

                // Campos Standard NetSuite
                var FEATURE_APPROVAL = runtime.getCurrentScript().getParameter({ name: "CUSTOMAPPROVALCUSTINVC" });
                if( (FEATURE_APPROVAL == true || FEATURE_APPROVAL == "T") && (WHT_Transaction == "invoice") ) {
                  newTransaction.setValue({ fieldId: "approvalstatus", value: 2 });
                }

                if( WHT_Transaction == "vendorbill" ){
                  newTransaction.setValue({ fieldId: "approvalstatus", value: 2 });
                }

                newTransaction.setValue({ fieldId: "entity", value: transactionEntity });
                newTransaction.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });

                var transactionAccount = recordObj.getValue({ fieldId: "account" });
                newTransaction.setValue({ fieldId: "account", value: transactionAccount });

                var transactionDate = recordObj.getValue({ fieldId: "trandate" });
                newTransaction.setValue({ fieldId: "trandate", value: transactionDate });

                var transactionPeriod = recordObj.getValue({ fieldId: "postingperiod" });
                newTransaction.setValue({ fieldId: "postingperiod", value: transactionPeriod });

                var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
                newTransaction.setValue({ fieldId: "currency", value: transactionCurrency });

                newTransaction.setValue({ fieldId: "exchangerate", value: exchangeRate });
                newTransaction.setValue({ fieldId: "memo", value: "Latam - WHT " + WHT_Name });
                newTransaction.setValue({ fieldId: "tranid", value: "LTMP-" + transactionID });

                // SUB TAB TAX DETAILS
                newTransaction.setValue({ fieldId: "taxdetailsoverride", value: true });
                newTransaction.setValue({ fieldId: "taxregoverride", value: true });
                newTransaction.setValue({ fieldId: "taxpointdateoverride", value: true });

                var transactionNexus = recordObj.getValue({ fieldId: "nexus" });
                newTransaction.setValue({ fieldId: "nexus", value: transactionNexus });

                var transactionTaxType = recordObj.getValue({ fieldId: "custbody_ste_transaction_type" });
                if( transactionTaxType != null && transactionTaxType != "" ) {
                  newTransaction.setValue({ fieldId: "custbody_ste_transaction_type", value: transactionTaxType });
                }

                var transactionSubsiTaxRegNumber = recordObj.getValue({ fieldId: "subsidiarytaxregnum" });
                newTransaction.setValue({ fieldId: "subsidiarytaxregnum", value: transactionSubsiTaxRegNumber });

                var transactionEntityTaxRegNumber = recordObj.getValue({ fieldId: "entitytaxregnum" });
                newTransaction.setValue({ fieldId: "entitytaxregnum", value: transactionEntityTaxRegNumber });

                var transactionTaxPointDate = recordObj.getValue({ fieldId: "taxpointdate" });
                transactionTaxPointDate = format.parse({
                  value: transactionTaxPointDate,
                  type: format.Type.DATE
                });
                newTransaction.setValue({ fieldId: "taxpointdate", value: transactionTaxPointDate });

                // Segmentacion
                var transactionDepartment = recordObj.getValue({ fieldId: "department" });
                if( transactionDepartment != null && transactionDepartment != "" ) {
                  newTransaction.setValue({ fieldId: "deparment", value: transactionDepartment });
                } else {
                  transactionDepartment = recordObj.getSublistValue({ sublistId: "item", fieldId: "department", line: 0 });
                }

                var transactionClass = recordObj.getValue({ fieldId: "class" });
                if( transactionClass != null && transactionClass != "" ) {
                  newTransaction.setValue({ fieldId: "class", value: transactionClass });
                } else {
                  transactionClass = recordObj.getSublistValue({ sublistId: "item", fieldId: "class", line: 0 });
                }

                var transactionLocation = recordObj.getValue({ fieldId: "location" });
                if( transactionLocation != null && transactionLocation != "" ) {
                  newTransaction.setValue({ fieldId: "location", value: transactionLocation });
                } else{
                  transactionLocation = recordObj.getSublistValue({ sublistId: "item", fieldId: "location", line: 0 });
                }

                // Campos LatamReady
                newTransaction.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
                newTransaction.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });

                // Campos WHT
                newTransaction.setValue({ fieldId: "custbody_lmry_co_reteica", value: "" });
                newTransaction.setValue({ fieldId: "custbody_lmry_co_reteiva", value: "" });
                newTransaction.setValue({ fieldId: "custbody_lmry_co_retefte", value: "" });
                newTransaction.setValue({ fieldId: "custbody_lmry_co_autoretecree", value: "" });
                newTransaction.setValue({ fieldId: "custbody_lmry_co_reteica_amount", value: 0 });
                newTransaction.setValue({ fieldId: "custbody_lmry_co_reteiva_amount", value: 0 });
                newTransaction.setValue({ fieldId: "custbody_lmry_co_retefte_amount", value: 0 });
                newTransaction.setValue({ fieldId: "custbody_lmry_co_retecree_amount", value: 0 });

                newTransaction.setValue({ fieldId: "custbody_lmry_wht_base_amount", value: baseAmount});

                // Lineas
                newTransaction.setSublistValue({ sublistId: "item", fieldId: "item", line: 0, value: WHT_Item });
                newTransaction.setSublistValue({ sublistId: "item", fieldId: "quantity", line: 0, value: 1 });
                newTransaction.setSublistValue({ sublistId: "item", fieldId: "price", line: 0, value: -1 });
                newTransaction.setSublistValue({ sublistId: "item", fieldId: "rate", line: 0, value: whtAmount });
                newTransaction.setSublistValue({ sublistId: "item", fieldId: "deparment", line: 0, value: transactionDepartment });
                newTransaction.setSublistValue({ sublistId: "item", fieldId: "class", line: 0, value: transactionClass });
                newTransaction.setSublistValue({ sublistId: "item", fieldId: "location", line: 0, value: transactionLocation });
                newTransaction.setSublistValue({ sublistId: "item", fieldId: "custcol_lmry_base_amount", line: 0, value: baseAmount });

                var saveTransaction = newTransaction.save({
                  enableSourcing: true,
                  ignoreMandatoryFields: true,
                  disableTriggers: true
                });

                var applyRecord = record.load({
                  type: WHT_Transaction,
                  id: saveTransaction
                });

                // Llena línea del Tax Detail
                var recordLineCount = applyRecord.getLineCount({ sublistId: "item" });
                if( recordLineCount > 0 ) {
                  for( var i = 0; i < recordLineCount; i++ ) {
                    var recordDetailReference = applyRecord.getSublistValue({ sublistId: "item", fieldId: "taxdetailsreference", line: i });
                    if( recordDetailReference != null || recordDetailReference != "" ) {
                      applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxdetailsreference", line: i, value: recordDetailReference });
                      applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxtype", line: i, value: STS_Json.taxtype });
                      applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxcode", line: i, value: STS_Json.taxcode });
                      applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", line: i, value: whtAmount });
                      applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", line: i, value: 0.0 });
                      applyRecord.setSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", line: i, value: 0.0 });
                    }
                  }
                }

                newRecord = applyRecord.save({
                  enableSourcing: true,
                  ignoreMandatoryFields: true,
                  disableTriggers: true
                });

                record.submitFields({
                  type: WHT_Transaction,
                  id: saveTransaction,
                  values: {
                    "tranid": "LWHT " + saveTransaction,
                    "account": transactionAccount
                  },
                  option: {
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                  }
                });

              } else if( WHT_Kind == 2 ) {

                var newJournalEntry = record.create({
                  type: record.Type.JOURNAL_ENTRY,
                  isDynamic: true
                });

                WHT_CustomForm = runtime.getCurrentScript().getParameter({ name: "custscript_lmry_wht_journal_entry" });
                if( WHT_CustomForm != null && WHT_CustomForm != "" ) {
                  newJournalEntry.setValue({ fieldId: "customform", value: WHT_CustomForm });
                }

                // Campos estandar de NetSuite
                newJournalEntry.setValue({ fieldId: "subsidiary", value: transactionSubsidiary });

                var transactionDate = recordObj.getValue({ fieldId: "trandate" });
                newJournalEntry.setValue({ fieldId: "trandate", value: transactionDate });

                var transactionPeriod = recordObj.getValue({ fieldId: "postingperiod" });
                newJournalEntry.setValue({ fieldId: "postingperiod", value: transactionPeriod });

                var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
                newJournalEntry.setValue({ fieldId: "currency", value: transactionCurrency });

                newJournalEntry.setValue({ fieldId: "exchangerate", value: exchangeRate });
                newJournalEntry.setValue({ fieldId: "memo", value: "Latam - WHT " + WHT_Name });

                // var transactionNexus = recordObj.getValue({ fieldId: "nexus" });
                // newJournalEntry.setValue({ fieldId: "nexus", value: transactionNexus });
                //
                // var transactionTaxType = recordObj.getValue({ fieldId: "custbody_ste_transaction_type" });
                // if( transactionTaxType != null && transactionTaxType != "" ) {
                //   newJournalEntry.setValue({ fieldId: "custbody_ste_transaction_type", value: transactionTaxType });
                // }
                //
                // var transactionSubsiTaxRegNumber = recordObj.getValue({ fieldId: "subsidiarytaxregnum" });
                // newJournalEntry.setValue({ fieldId: "subsidiarytaxregnum", value: transactionSubsiTaxRegNumber });

                // Segmentacion
                var transactionDepartment = recordObj.getValue({ fieldId: "department" });
                if( transactionDepartment != null && transactionDepartment != "" ) {
                  newJournalEntry.setValue({ fieldId: "deparment", value: transactionDepartment });
                } else {
                  transactionDepartment = recordObj.getSublistValue({ sublistId: "item", fieldId: "department", line: 0 });
                }

                var transactionClass = recordObj.getValue({ fieldId: "class" });
                if( transactionClass != null && transactionClass != "" ) {
                  newJournalEntry.setValue({ fieldId: "class", value: transactionClass });
                } else {
                  transactionClass = recordObj.getSublistValue({ sublistId: "item", fieldId: "class", line: 0 });
                }

                var transactionLocation = recordObj.getValue({ fieldId: "location" });
                if( transactionLocation != null && transactionLocation != "" ) {
                  newJournalEntry.setValue({ fieldId: "location", value: transactionLocation });
                } else{
                  transactionLocation = recordObj.getSublistValue({ sublistId: "item", fieldId: "location", line: 0 });
                }

                // Campos LatamReady
                newJournalEntry.setValue({ fieldId: "custbody_lmry_reference_transaction", value: transactionID });
                newJournalEntry.setValue({ fieldId: "custbody_lmry_reference_transaction_id", value: transactionID });
                newJournalEntry.setValue({ fieldId: "custbody_lmry_reference_entity", value: transactionEntity});

                // Linea de Debito
                newJournalEntry.selectNewLine({ sublistId: "line" });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: WHT_CreditAcc });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "debit", value: whtAmount });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: "Latam - WHT " + WHT_Name });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "deparment", value: transactionDepartment });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: transactionClass });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: transactionLocation });
                newJournalEntry.commitLine({ sublistId: "line" });

                // Linea de Credito
                newJournalEntry.selectNewLine({ sublistId: "line" });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "account", value: WHT_LiabilityAcc });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "credit", value: whtAmount });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "memo", value: "Latam - WHT " + WHT_Name });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "entity", value: transactionEntity });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "deparment", value: transactionDepartment });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "class", value: transactionClass });
                newJournalEntry.setCurrentSublistValue({ sublistId: "line", fieldId: "location", value: transactionLocation });
                newJournalEntry.commitLine({ sublistId: "line" });

                newJournalEntry.save({
                  enableSourcing: true,
                  ignoreMandatoryFields: true,
                  disableTriggers: true
                });

              }

            }

          }

        }

        return newRecord;

      } catch (e) {
        Library_Mail.sendemail( "Create_WHT_2 - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para recuperar el monto base al cual se le aplicará la retencion
     *    - transactionType: Tipo de trasaccion
     *    - transactionID: ID de la transaccion
     *    - recordObj: Transaccion
     *    - WHT_ID: Withholding Tax
     ***************************************************************************/
    function getWhtAmountByWHT( transactionType, transactionID, recordObj, WHT_ID ) {

      try {

        if( WHT_ID != null && WHT_ID != "" ) {

          var WHT_Search = search.load({ id: "customsearch_lmry_wht_base" });
          WHT_Search.filters.push( search.createFilter({
            name: "internalid",
            operator: search.Operator.ANYOF,
            values: [WHT_ID]
          }) );

          var WHT_SearchResult = WHT_Search.run().getRange(0, 10);

          if( WHT_SearchResult != null && WHT_SearchResult.length > 0 ){

            var WHT_SearchResultColumns = WHT_SearchResult[0].columns;
            var WHT_Name = WHT_SearchResult[0].getValue("name");
            var WHT_Rate = 0;
            if( WHT_SearchResult[0].getValue("custrecord_lmry_wht_coderate") != null && WHT_SearchResult[0].getValue("custrecord_lmry_wht_coderate") != "" ) {
              WHT_Rate = WHT_SearchResult[0].getValue("custrecord_lmry_wht_coderate");
            }
            var WHT_DateFrom = WHT_SearchResult[0].getValue(WHT_SearchResultColumns[6]);
            var WHT_DateUntil = WHT_SearchResult[0].getValue(WHT_SearchResultColumns[7]);
            var WHT_CustomField = WHT_SearchResult[0].getValue(WHT_SearchResultColumns[4]);
            var WHT_MinAmount = 0;
            if( WHT_SearchResult[0].getValue("custrecord_lmry_wht_codeminbase") != null && WHT_SearchResult[0].getValue("custrecord_lmry_wht_codeminbase") != "" ) {
              WHT_MinAmount = WHT_SearchResult[0].getValue("custrecord_lmry_wht_codeminbase");
            }

            var exchangeRate = getExchangeRate( recordObj );
            var transactionDate = getFormatDate( recordObj.getValue({ fieldId: "trandate" }) );

            var WHT_Base = "";
            // VARIABLE PARA VENTAS
            if( transactionType == "invoice" || transactionType == "creditmemo" ) {
              WHT_Base = WHT_SearchResult[0].getValue( WHT_SearchResultColumns[12] );
            }
            // VARIABLE PARA COMPRAS
            if( transactionType == "vendorbill" || transactionType == "vendorcredit" ) {
              WHT_Base = WHT_SearchResult[0].getValue( WHT_SearchResultColumns[16] );
            }

            if( WHT_Base != null || WHT_Base != "" ) {

              var baseAmount = 0;
              var auxAmount = 0;

              if( (WHT_Base == "subtotal") && (transactionType == "vendorbill" || transactionType == "vendorcredit") ) {
                var grossAmount = recordObj.getValue({ fieldId: "total" });
                var taxAmount = recordObj.getValue({ fieldId: "taxtotal" });
                baseAmount = parseFloat( grossAmount - taxAmount );
              } else {
                baseAmount = parseFloat( recordObj.getValue({ fieldId: WHT_Base }) );
              }
              auxAmount = baseAmount;

              var whtAmount = 0;
              var auxWhtAmount = 0;
              if( baseAmount != "" && baseAmount != null ) {

                // Sin tipo de cambio
                auxWhtAmount = parseFloat( auxAmount ) * parseFloat( WHT_Rate );
                auxWhtAmount = parseFloat( auxWhtAmount ) / 100;
                auxWhtAmount = Math.round( auxWhtAmount * 100 ) / 100;

                // Con tipo de cambio
                whtAmount = parseFloat( baseAmount ) * parseFloat( WHT_Rate );
                whtAmount = parseFloat( whtAmount ) / 100;
                whtAmount = whtAmount * exchangeRate;
                whtAmount = Math.round( whtAmount * 100 ) / 100;

              }

              var tempAmount = parseFloat( baseAmount ) * exchangeRate;
              // log.error('Search_WHT - ' + transactionType + ' : ' + WHT_DateFrom + ' <= ' + transactionDate + ' <= ' + WHT_DateUntil,
              //   'Search_WHT - Solo si es mayor o igual ' + tempAmount + ' >= ' + WHT_MinAmount +
              //   ' y ' + whtAmount + ' > 0');
              if( (WHT_DateFrom != null && WHT_DateFrom != "") && (WHT_DateUntil != null && WHT_DateUntil != "") &&
                  (WHT_DateFrom <= transactionDate && transactionDate <= WHT_DateUntil) &&
                  ((tempAmount >= parseFloat(WHT_MinAmount) && tempAmount > 0) && parseFloat(whtAmount) > 0) ) {

                var detailJSON = '{"' + WHT_CustomField + '":"' + whtAmount + '"}';
                detailJSON = JSON.parse( detailJSON );

                record.submitFields({
                  type: transactionType,
                  id: transactionID,
                  values: detailJSON,
                  options: {
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                  }
                });

              } else {

                var detailJSON = '{"' + WHT_CustomField + '":"0"}';
                detailJSON = JSON.parse( detailJSON );

                record.submitFields({
                  type: transactionType,
                  id: transactionID,
                  values: detailJSON,
                  options: {
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                    disableTriggers: true
                  }
                });

              }

              return whtAmount;

            }

          }

        }

        return null;

      } catch (e) {
        Library_Mail.sendemail( "getWhtAmountByWHT - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para eliminar los Journal Entry creados
     *    - transactionID: ID de la transaccion
     ***************************************************************************/
    function deleteJournalEntry( transactionID ) {

      try {

        if( transactionID != null && transactionID != "" ) {

          var JE_Search = search.create({
            type: search.Type.JOURNAL_ENTRY,
            columns: [ "internalid" ],
            filters: [
              [ "mainline", "IS", ["T"] ],
              "AND",
              [ "custbody_lmry_reference_transaction_id", "EQUALTO", [transactionID] ]
            ]
          });
          var JE_SearchResult = JE_Search.run().getRange(0, 1000);

          if( JE_SearchResult != null && JE_SearchResult.length > 0 ) {
            var auxID = 0;
            for( var i = 0; i < JE_SearchResult.length; i++ ) {
              var JE_InternalID = JE_SearchResult[i].getValue("internalid");
              if( JE_InternalID != auxID ) {
                auxID = JE_InternalID;
                record.delete({
                  type: record.Type.JOURNAL_ENTRY,
                  id: JE_InternalID
                });
              }
            }
          }

        }

      } catch (e) {
        Library_Mail.sendemail( "deleteJournalEntry - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para eliminar Credit Memo / Vendor Credit
     *    - transactionType: Tipo de transacion (credit memo, vendor credit)
     *    - transactionID: ID de la transaccion
     ***************************************************************************/
    function deleteTransactionByType( transactionType, transactionID ) {

      try {

        if( transactionID != null && transactionID != "" ) {

          var Transaction_Search = search.create({
            type: transactionType,
            columns: [ "internalid" ],
            filters: [
              [ "mainline", "IS", ["T"] ],
              "AND",
              [ "custbody_lmry_reference_transaction_id", "EQUALTO", [transactionID] ],
              "AND",
              [ "memo", "STARTSWITH", ["Latam - WHT"] ]
            ]
          });
          var Transaction_SearchResult = Transaction_Search.run().getRange(0, 1000);

          if( Transaction_SearchResult != null && Transaction_SearchResult.length > 0 ) {
            var auxID = 0;
            for( i = 0; i < Transaction_SearchResult.length; i++ ) {
              var TransactionID = Transaction_SearchResult[i].getValue("internalid");
              if( TransactionID != auxID ) {
                auxID = TransactionID;
                record.delete({
                  type: transactionType,
                  id: TransactionID
                });
              }
            }
          }

        }

      } catch (e) {
        Library_Mail.sendemail( "deleteTransactionByType - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para aplicar los creditos a las transacciones (creditmemo / vendorcredit)
     *    - transactionID: ID de la transaccion raíz
     *    - transactionType: El tipo de transaccion raíz
     *    - transactionToApply: ids de las transaccion a ser aplicadas
     *    - transactionToUnapply: ids de las transaccion para quitar el apply
     ***************************************************************************/
    function applyToTransactions( transactionID, transactionType, transactionToApply, transactionToUnapply ) {

      try {

        var transactionRecord = record.load({
          type: transactionType,
          id: transactionID,
          isDynamic: true
        });

        var applyLineCount = transactionRecord.getLineCount({ sublistId: "apply" });
        for( var i = 0; i < applyLineCount; i++ ) {
          var applyTransaction = transactionRecord.getSublistValue({ sublistId: "apply", fieldId: "apply", line: i });
          var applyTransactionID = transactionRecord.getSublistValue({ sublistId: "apply", fieldId: "doc", line: i });
          // Se desaplican los invoice/bills para poder eliminarlos despues
          if( applyTransaction == true || applyTransaction == "T" ) {
            if( transactionToUnapply.indexOf(Number(applyTransactionID)) != -1 ) {
              transactionRecord.selectLine({ sublistId: 'apply', line: i });
              transactionRecord.setCurrentSublistValue({ sublistId: "apply", fieldId: "apply", value: false, line: i });
            }
          }

          //se aplican las nuevas transacciones
          if( transactionToApply.indexOf(Number(applyTransactionID)) != -1 ) {
            transactionRecord.selectLine({ sublistId: 'apply', line: i });
            transactionRecord.setCurrentSublistValue({ sublistId: "apply", fieldId: "apply", value: true, line: i });
          }

        }

        transactionRecord.save({
          enableSourcing: true,
          ignoreMandatoryFields: true,
          disableTriggers: true
        });

        for( var i = 0; i < transactionToUnapply.length; i++ ) {
          record.delete({
            type: GENERATED_TRANSACTION[transactionType],
            id: transactionToUnapply[i]
          });
        }

        return true;

      } catch (e) {
        Library_Mail.sendemail( "applyTransaction - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para recuperar los ids de las transacciones relacionadas por
     * tipo de transaction (invoice o vendorbill)
     *    - transactionID: ID de la transaccion de la cual se crearon las
     *      transacciones a recuperar
     *    - transactionType: El tipo de transaccion de los transacciones a recuperar
     ***************************************************************************/
    function getTransactionsToApply( transactionID, transactionType ) {

      try {

        var transactionArray = [];
        var transactionSearch = search.create({
          type: transactionType,
          columns: [ "internalid" ],
          filters: [
            [ "mainline", "is", "T" ], "AND",
            [ "custbody_lmry_reference_transaction_id", "equalto", transactionID ], "AND",
            [ "memo", "startswith", WHT_MEMO ]
          ]
        });

        var transactionSearchResult = transactionSearch.run().getRange(0, 1000);
        if( transactionSearchResult != null && transactionSearchResult.length > 0 ) {
          for( var i = 0; i < transactionSearchResult.length; i++ ) {
            transactionArray.push( Number(transactionSearchResult[i].getValue("internalid")) );
          }
        }

        return transactionArray;

      } catch (e) {
        Library_Mail.sendemail( "getTransactionsToApply - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para recuperar el tipo de cambio de la transaccion o libro para
     * la conversion a moneda base
     *    - recordObj: Transaccion
     ***************************************************************************/
    function getExchangeRate( recordObj ) {

      try {

        // FEATURES
        var FEATURE_MULTIBOOK = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });
        var FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

        // VALORES DE LA TRANSACCION
        var exchangeRate = 1;
        var transactionCurrency = recordObj.getValue({ fieldId: "currency" });
        var transactionExchangeRate = recordObj.getValue({ fieldId: "exchangerate" });
        var transactionSubsidiary = recordObj.getValue({ fieldId: "subsidiary" });

        // CURRENCY DEL RECORD LATAMREADY - SETUP TAX SUBSIDIARY
        var setupCurrency = 0;
        var STS_Search = search.create({
          type: "customrecord_lmry_setup_tax_subsidiary",
          columns: [ "custrecord_lmry_setuptax_subsidiary", "custrecord_lmry_setuptax_currency" ],
          filters: [
            [ "isinactive", "is", ["F"] ]
          ]
        });

        if( FEATURE_SUBSIDIARY ) {
          STS_Search.filters.push( search.createFilter({
            name: "custrecord_lmry_setuptax_subsidiary",
            operator: "is",
            values: transactionSubsidiary
          }) );
        }

        var STS_SearchResult = STS_Search.run().getRange(0, 10);
        if( STS_SearchResult != null && STS_SearchResult.length > 0 ) {
          setupCurrency = STS_SearchResult[0].getValue("custrecord_lmry_setuptax_currency");
        }

        // OneWorld Y MultiBook
        if( (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") && (FEATURE_MULTIBOOK == true || FEATURE_MULTIBOOK == "T") ) {

          var subsidiaryCurrency = search.lookupFields({
            type: "subsidiary",
            id: transactionSubsidiary,
            columns: [ "currency" ]
          });
          subsidiaryCurrency = subsidiaryCurrency.currency[0].value;

          var bookLineCount = recordObj.getLineCount({ sublistId: "accountingbookdetail" });
          if( subsidiaryCurrency != setupCurrency && subsidiaryCurrency != null && subsidiaryCurrency != "" ){

            if( bookLineCount > 0 ) {
              for( var i = 0; i < bookLineCount; i++ ) {
                var bookCurrency = recordObj.getSublistValue({ sublistId: "accountingbookdetail", fieldId: "currency", line: i });
                if( bookCurrency == setupCurrency ) {
                  exchangeRate = recordObj.getSublistValue({ sublistId: "accountingbookdetail", fieldId: "exchangerate", line: i });
                  break;
                }
              }
            }

          } else {
            // NO ESTA COFIGURADO EL SETUP TAX SUBSIDIARY
            exchangeRate = transactionExchangeRate;
          }

        } else {
          // NO ES OneWorld O NO TIENE MultiBook
          exchangeRate = transactionExchangeRate;
        }

        return exchangeRate;

      } catch (e) {
        Library_Mail.sendemail( "getExchangeRate - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para darle formato a la fecha de la transaccion
     *    - recordObj: Transaccion
     ***************************************************************************/
    function getFormatDate( transactionDate ) {

      try {

        if( transactionDate != null || transactionDate != "" ) {

          var year = transactionDate.getFullYear();
          var month = "" + (transactionDate.getMonth() + 1);
          if( month.length < 2 ) {
            month = "0" + month;
          }
          var day = transactionDate.getDate();
          if( day.length < 2 ) {
            day = "0" + day;
          }

          var transactionDate = "" + year + "" + month + "" + day;

          return transactionDate;

        }

      } catch (e) {
        Library_Mail.sendemail( "getFormatDate - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para recuperar el Tax Code configurado en el record:
     * LatamReady - Setup Tax Subsidiary
     *    - transactionSubsidiary: Subsiaria del cuál se recuperará su setup
     ***************************************************************************/
    function getTaxCodeFromSetupSubsidiary( transactionSubsidiary ) {

      try {

        var STS_Search = search.create({
          type: "customrecord_lmry_setup_tax_subsidiary",
          columns: [
            search.createColumn({
              name: "custrecord_lmry_setuptax_tax_code",
              label: "Tax Code"
            }),
            search.createColumn({
              name: "taxtype",
              join: "CUSTRECORD_LMRY_SETUPTAX_TAX_CODE",
              label: "Tax Type"
            })
          ],
          filters: [
            [ "isinactive", "is", ["F"] ],
            "AND",
            [ "custrecord_lmry_setuptax_subsidiary", "anyof", transactionSubsidiary ]
          ]
        });
        var STS_SearchResult = STS_Search.run().getRange(0, 10);

        var STS_Json = {};
        if( STS_SearchResult != null && STS_SearchResult.length > 0 ) {
          STS_Columns = STS_SearchResult[0].columns
          STS_Json = {
            taxcode: STS_SearchResult[0].getValue(STS_Columns[0]),
            taxtype: STS_SearchResult[0].getValue(STS_Columns[1])
          }
        }

        return STS_Json;

      } catch (e) {
        Library_Mail.sendemail( "getTaxCodeFromSetupSubsidiary - Error: " + e, LMRY_SCRIPT );
        log.error('[ Error ]', e);
      }

    }

    /***************************************************************************
     * Funcion para redondear a 2 decimales
     *    - num: Valor a redondear
     ***************************************************************************/
    function round2(num) {
      if (num >= 0) {
        return parseFloat(Math.round(parseFloat(num) * 1e2 + 1e-3) / 1e2);
      } else {
        return parseFloat(Math.round(parseFloat(num) * 1e2 - 1e-3) / 1e2);
      }
    }

    return {
      setWHTTotalTransaction: setWHTTotalTransaction
    };

  });
