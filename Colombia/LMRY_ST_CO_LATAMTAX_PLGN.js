/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       Jun 2021        LatamReady
 * File : LMRY_ST_CO_LATAMTAX_PLGN.JS
 */
var scriptContext = nlapiGetContext();

 /**
  * varuables globales
  */
var LMRY_SCRIPT = "LatamReady - ST CO LATAMTAX Plug-in";

var FEATURE_MULTIBOOK = false;
var FEATURE_SUBSIDIARY = false;

var FEATURE_DEPARTMENT = false;
var FEATURE_CLASS = false;
var FEATURE_LOCATION = false;

var MANDATORY_DEPARTMENT = false;
var MANDATORY_CLASS = false;
var MANDATORY_LOCATION = false;

var DEPARTMENT_LINE = false;
var CLASS_LINE = false;

var entity = 0;

var itemArray = [];

function customizeGlImpact( transactionRecord, standardLines, customLines, book ) {

  try {

    var taxDetailOverride = transactionRecord.getFieldValue( "taxdetailsoverride" );
    if( taxDetailOverride == true || taxDetailOverride == "T" ) {

      var transactionType = transactionRecord.getRecordType();
      var country = transactionRecord.getFieldText( "custbody_lmry_subsidiary_country" );

      if( country != "" && country != null ) {
        country = country.substring(0, 3).toUpperCase();
      }

      // var licenses = getLicenses( transactionRecord.getFieldValue( "subsidiary" ) );
      // if( getAuthorization( 645, licenses ) == false ) {
      //   return true;
      // }

      // FEATURE DE LOCALIZACION
      FEATURE_DEPARTMENT = scriptContext.getSetting( "FEATURE", "DEPARTMENTS" );
      FEATURE_DEPARTMENT = scriptContext.getSetting( "FEATURE", "CLASSES" );
      FEATURE_DEPARTMENT = scriptContext.getSetting( "FEATURE", "LOCATIONS" );

      // FEATURE DE INSTANCIA
      FEATURE_SUBSIDIARY = scriptContext.getFeature( "SUBSIDIARIES" );
      FEATURE_MULTIBOOK = scriptContext.getFeature( "MULTIBOOK" );

      entity = transactionRecord.getFieldValue( "entity" );
      var transactionDate = transactionRecord.getFieldValue( "trandate" );
      var transactionLocation = transactionRecord.getFieldValue( "location" );

      var subsidiary = "";
      if( FEATURE_SUBSIDIARY ) {
        subsidiary = transactionRecord.getFieldValue( "subsidiary" );
      } else {
        subsidiary = transactionRecord.getFieldValue( "custbody_lmry_subsidiary_country" );
      }

      var filtroTransactionType = "";
      switch ( transactionType ) {
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
        case 'purchaseorder':
            filtroTransactionType = 6;
            break;
        default:
            return true;
      }

      var documentType = transactionRecord.getFieldValue( "custbody_lmry_document_type" );
      var itemLineCount = transactionRecord.getLineItemCount( "item" );

      var expenseLineCount = 0;
      if( filtroTransactionType == 4 || filtroTransactionType == 7 ) {
        expenseLineCount = transactionRecord.getLineItemCount( "expense" );
      }

      var STS_Json = getSetupTaxSubsidiary( subsidiary );
      var exchangeRate = getExchangeRate( transactionRecord, subsidiary, STS_Json );

      MANDATORY_DEPARTMENT = scriptContext.getPreference( "DEPTMANDATORY" );
      MANDATORY_CLASS = scriptContext.getPreference( "LOCMANDATORY" );
      MANDATORY_LOCATION = scriptContext.getPreference( "CLASSMANDATORY" );
      DEPARTMENT_LINE = scriptContext.getPreference( "DEPTSPERLINE" );
      CLASS_LINE = scriptContext.getPreference( "CLASSESPERLINE" );

      var saleTransactionTypes = [ "invoice", "creditmemo" ];
      var purchaseTransactionTypes = [ "vendorbill", "vendorcredit" ];
      if( saleTransactionTypes.indexOf( transactionType ) != -1 || purchaseTransactionTypes.indexOf( transactionType ) != -1 ) {

        var searchResultCC = getContributoryClasses( subsidiary, transactionDate, filtroTransactionType, entity, documentType, STS_Json );
        var searchResultNT = getNationalTaxes( subsidiary, transactionDate, filtroTransactionType, documentType, STS_Json );

        if( searchResultCC != null && searchResultCC.length > 0 ) {

          for( var i = 0; i < searchResultCC.length; i++ ) {

            var columnasCC = searchResultCC[i].getAllColumns();
            var CC_taxRate = searchResultCC[i].getValue( "custrecord_lmry_ar_ccl_taxrate" );
            var CC_subType = searchResultCC[i].getText( "custrecord_lmry_sub_type" );
            var CC_subTypeID = searchResultCC[i].getValue( "custrecord_lmry_sub_type" );
            var CC_debitAccount = searchResultCC[i].getValue( "custrecord_lmry_br_ccl_account1" );
            var CC_creditAccount = searchResultCC[i].getValue( "custrecord_lmry_br_ccl_account2" );
            var CC_Department = searchResultCC[i].getValue( "custrecord_lmry_ar_ccl_department" );
            var CC_Class = searchResultCC[i].getValue( "custrecord_lmry_ar_ccl_class" );
            var CC_Location = searchResultCC[i].getValue( "custrecord_lmry_ar_ccl_location" );
            var CC_isExempt = searchResultCC[i].getValue( "custrecord_lmry_ar_ccl_isexempt" );
            var CC_invoicingIdentifier = searchResultCC[i].getValue( "custrecord_lmry_cc_invoice_identifier" );
            var CC_ItemAccount = searchResultCC[i].getValue( columnasCC[9] );

            if( country == "COL" ) {
              // For de items
              for( var j = 1; j <= itemLineCount; j++ ) {

                var itemID = transactionRecord.getLineItemValue( "item", "item", j );
                var itemInvoicingIdentifier = transactionRecord.getLineItemValue( "item", "custcol_lmry_invoicing_id", j );

                if( CC_invoicingIdentifier == itemInvoicingIdentifier ) {

                  var itemNetAmount = transactionRecord.getLineItemValue( "item", "amount", j );
                  var itemTaxAmountByCC = Math.round( parseFloat(itemNetAmount) * parseFloat(CC_taxRate) );

                  if( itemTaxAmountByCC > 0 ) {

                    if( FEATURE_MULTIBOOK == true || FEATURE_MULTIBOOK == "T" ) {
                      itemTaxAmountByCC = tipoCambioMB( transactionRecord, book, itemTaxAmountByCC );
                      if( Math.round(itemTaxAmountByCC * 100) == 0 ) {
                        continue;
                      }
                    }

                    var itemDetails = {};
                    itemDetails["subtype"] = { text: CC_subType, value: CC_subTypeID };

                    if( STS_Json.depclassloc == true || STS_Json.depclassloc == "T" ) {
                      // Segmentación del CC
                      itemDetails["department"] = elegirSegmentacion( MANDATORY_DEPARTMENT, CC_Department, transactionRecord.getLineItemValue("item", "department", j), STS_Json.department, transactionRecord.getFieldValue("department") );
                      itemDetails["class"] = elegirSegmentacion( MANDATORY_CLASS, CC_Class, transactionRecord.getLineItemValue("item", "class", j), STS_Json.class, transactionRecord.getFieldValue("class") );
                      itemDetails["location"] = elegirSegmentacion( MANDATORY_LOCATION, CC_Location, transactionRecord.getLineItemValue("item", "location", j), STS_Json.location, transactionRecord.getFieldValue("location") );
                    } else {
                      // Segmentación del Item
                      itemDetails["department"] = elegirSegmentacion( MANDATORY_DEPARTMENT, transactionRecord.getLineItemValue("item", "department", j), CC_Department, STS_Json.department, "" );
                      itemDetails["class"] = elegirSegmentacion( MANDATORY_CLASS, transactionRecord.getLineItemValue("item", "class", j), CC_Class, STS_Json.class, "" );
                      itemDetails["location"] = elegirSegmentacion( MANDATORY_LOCATION, transactionRecord.getLineItemValue("item", "location", j), CC_Location, STS_Json.location, "" );
                    }

                    if( STS_Json.accountgl == false || STS_Json.accountgl == "F" ) {

                      // Cuentas del Item y Transacción
                      if( filtroTransactionType == 1 ||filtroTransactionType == 2 ||filtroTransactionType == 10 ) {
                        // Invoice - Sales Order - Estimate
                        itemDetails["debitaccount"] = parseFloat( CC_ItemAccount ); // Cuenta del Item
                        itemDetails["creditaccount"] = parseFloat( transactionRecord.getFieldValue( "account" ) ); // Cuenta de la transacción
                      }

                      if( filtroTransactionType == 4 ) {
                        // Vendor Bill
                        itemDetails["debitaccount"] = parseFloat( transactionRecord.getFieldValue( "account" ) ); // Cuenta de la transacción
                        itemDetails["creditaccount"] = parseFloat( CC_ItemAccount ); // Cuenta del Item
                      }

                      if( filtroTransactionType == 8 ) {
                        // Credit Memo
                        itemDetails["debitaccount"] = parseFloat( transactionRecord.getFieldValue( "account" ) ); // Cuenta de la Transacción
                        itemDetails["creditaccount"] = parseFloat( CC_ItemAccount ); // Cuenta del Item
                      }

                    } else {

                      // Cuentas del CC
                      if( filtroTransactionType == 1 ||filtroTransactionType == 2 ||filtroTransactionType == 10 ) {
                        // Invoice - Sales Order - Estimate
                        itemDetails["debitaccount"] = parseFloat( CC_debitAccount );
                        itemDetails["creditaccount"] = parseFloat( CC_creditAccount );
                      }

                      if( filtroTransactionType == 4 ) {
                        // Vendor Bill
                        itemDetails["debitaccount"] = parseFloat( CC_creditAccount );
                        itemDetails["creditaccount"] = parseFloat( CC_debitAccount );
                      }

                      if( filtroTransactionType == 8 ) {
                        // Credit Memo
                        itemDetails["debitaccount"] = parseFloat( CC_creditAccount );
                        itemDetails["creditaccount"] = parseFloat( CC_debitAccount );
                      }

                    }

                    itemDetails["taxamount"] = itemTaxAmountByCC;
                    itemDetails["memo"] = " (LatamTax - Contributory Class) - (ID Item: " + itemID + ")";

                    if( STS_Json.summarizedgl == false || STS_Json.summarizedgl == "F" ) {
                      agregarLineas( customLines, book, itemDetails, 0, false, DEPARTMENT_LINE, CLASS_LINE );
                    } else {
                      itemArray.push( itemDetails );
                    }

                  }

                }

              }
              // For de expenses solo para para Vendor Bill y Vendor Credit
              if( filtroTransactionType == 4 || filtroTransactionType == 7 ) {

                for( var j = 1; j <= expenseLineCount; j++ ) {

                  var expenseAccountID = transactionRecord.getLineItemValue( "expense", "account", j );

                  var expenseNetAmount = transactionRecord.getLineItemValue( "expense", "amount", j );
                  var expenseTaxAmountByCC = Math.round( parseFloat(itemNetAmount) * parseFloat(CC_taxRate) );

                  if( expenseTaxAmountByCC > 0 ) {

                    if( FEATURE_MULTIBOOK == true || FEATURE_MULTIBOOK == "T" ) {
                      expenseTaxAmountByCC = tipoCambioMB( transactionRecord, book, expenseTaxAmountByCC );
                    }

                    var expenseDetails = {};
                    expenseDetails["subtype"] = { text: CC_subType, value: CC_subTypeID };

                    if( STS_Json.depclassloc == true || STS_Json.depclassloc == "T" ) {
                      // Segmentación del CC
                      expenseDetails["department"] = elegirSegmentacion( MANDATORY_DEPARTMENT, CC_Department, transactionRecord.getLineItemValue("expense", "department", j), STS_Json.department, transactionRecord.getFieldValue("department") );
                      expenseDetails["class"] = elegirSegmentacion( MANDATORY_CLASS, CC_Class, transactionRecord.getLineItemValue("expense", "class", j), STS_Json.class, transactionRecord.getFieldValue("class") );
                      expenseDetails["location"] = elegirSegmentacion( MANDATORY_LOCATION, CC_Location, transactionRecord.getLineItemValue("expense", "location", j), STS_Json.location, transactionRecord.getFieldValue("location") );
                    } else {
                      // Segmentación del Expense
                      expenseDetails["department"] = elegirSegmentacion( MANDATORY_DEPARTMENT, transactionRecord.getLineItemValue("expense", "department", j), CC_Department, STS_Json.department, "" );
                      expenseDetails["class"] = elegirSegmentacion( MANDATORY_CLASS, transactionRecord.getLineItemValue("expense", "class", j), CC_Class, STS_Json.class, "" );
                      expenseDetails["location"] = elegirSegmentacion( MANDATORY_LOCATION, transactionRecord.getLineItemValue("expense", "location", j), CC_Location, STS_Json.location, "" );
                    }

                    if( STS_Json.accountgl == false || STS_Json.accountgl == "F" ) {

                      // Cuentas del Item y la Transaccion
                      if( filtroTransactionType == 7 ) {
                        // Bill Credit
                        expenseDetails["debitaccount"] = parseFloat( CC_ItemAccount ); // Cuenta del Item
                        expenseDetails["creditaccount"] = parseFloat( transactionRecord.getFieldValue("account") ); // Cuenta del transaccion
                      }
                      if( filtroTransactionType == 4 ) {
                        // Vendor Bill
                        expenseDetails["debitaccount"] = parseFloat( transactionRecord.getFieldValue("account") ); // Cuenta de la transaccion
                        expenseDetails["creditaccount"] = parseFloat( CC_ItemAccount ); // cuenta del Item
                      }

                    } else {

                      // Cuentas del CC
                      if( filtroTransactionType == 4 ) {
                        // Vendor Bill
                        expenseDetails["debitaccount"] = parseFloat( CC_debitAccount );
                        expenseDetails["creditaccount"] = parseFloat( CC_creditAccount );
                      }

                      if( filtroTransactionType == 7 ) {
                        // Vedor Credit
                        expenseDetails["debitaccount"] = parseFloat( CC_creditAccount );
                        expenseDetails["creditaccount"] = parseFloat( CC_debitAccount );
                      }

                    }

                    expenseDetails["taxamount"] = expenseTaxAmountByCC;
                    expenseDetails["memo"] = " (LatamTax - Contributory Class) - (ID Expense Account: " + expenseAccountID + ")";

                    if( STS_Json.summarizedgl == false || STS_Json.summarizedgl == "F" ) {
                      agregarLineas( customLines, book, expenseDetails, 0, false, DEPARTMENT_LINE, CLASS_LINE );
                    } else {
                      itemArray.push( expenseDetails );
                    }

                  }

                }

              }

            }

          }

        } else {

          if( searchResultNT != null && searchResultNT.length > 0 ) {

            for( var i = 1; i <= searchResultNT.length; i++ ) {

              var columnasNT = searchResultNT[i].getAllColumns();
              var NT_taxRate = searchResultNT[i].getValue( "custrecord_lmry_ntax_taxrate" );
              var NT_subType = searchResultNT[i].getText( "custrecord_lmry_ntax_sub_type" );
              var NT_subTypeID = searchResultNT[i].getValue( "custrecord_lmry_ntax_sub_type" );
              var NT_debitAccount = searchResultNT[i].getValue( "custrecord_lmry_ntax_debit_account" );
              var NT_creditAccount = searchResultNT[i].getValue( "custrecord_lmry_ntax_credit_account" );
              var NT_Department = searchResultNT[i].getValue( "custrecord_lmry_ntax_department" );
              var NT_Class = searchResultNT[i].getValue( "custrecord_lmry_ntax_class" );
              var NT_Location = searchResultNT[i].getValue( "custrecord_lmry_ntax_location" );
              var NT_isExempt = searchResultCC[i].getValue( "custrecord_lmry_ntax_isexempt" );
              var NT_invoicingIdentifier = searchResultCC[i].getValue( "custrecord_lmry_nt_invoicing_identifier" );
              var NT_ItemAccount = searchResultNT[i].getValue( columnasNT[9] );

              if( country == "COL" ) {

                for( var j = 0; j < itemLineCount; j++ ) {

                  var itemID = transactionRecord.getLineItemValue( "item", "item", j );
                  var itemInvoicingIdentifier = transactionRecord.getLineItemValue( "item", "custcol_lmry_invoicing_id", j );

                  if( NT_invoicingIdentifier == itemInvoicingIdentifier ) {

                    var itemNetAmount = transactionRecord.getLineItemValue( "item", "amount", j );
                    var itemTaxAmountByNT = Math.round( parseFloat(itemNetAmount) * parseFloat(NT_taxRate) );

                    if( itemTaxAmountByNT > 0 ) {

                      if( FEATURE_MULTIBOOK == true || FEATURE_MULTIBOOK == "T" ) {
                        itemTaxAmountByNT = tipoCambioMB( transactionRecord, book, itemTaxAmountByNT );
                        if( Math.round(itemTaxAmountByNT * 100) == 0 ){
                          continue;
                        }
                      }

                      var itemDetails = {};
                      itemDetails["subtype"] = { text: NT_subType, value: NT_subTypeID };

                      if( STS_Json.depclassloc == true || STS_Json.depclassloc == "T" ) {
                        // Segmentación del CC
                        itemDetails["department"] = elegirSegmentacion( MANDATORY_DEPARTMENT, NT_Department, transactionRecord.getLineItemValue("item", "department", j), STS_Json.department, transactionRecord.getFieldValue("department") );
                        itemDetails["class"] = elegirSegmentacion( MANDATORY_CLASS, NT_Class, transactionRecord.getLineItemValue("item", "class", j), STS_Json.class, transactionRecord.getFieldValue("class") );
                        itemDetails["location"] = elegirSegmentacion( MANDATORY_LOCATION, NT_Location, transactionRecord.getLineItemValue("item", "location", j), STS_Json.location, transactionRecord.getFieldValue("location") );
                      } else {
                        // Segmentación del Item
                        itemDetails["department"] = elegirSegmentacion( MANDATORY_DEPARTMENT, transactionRecord.getLineItemValue("item", "department", j), NT_Department, STS_Json.department, "" );
                        itemDetails["class"] = elegirSegmentacion( MANDATORY_CLASS, transactionRecord.getLineItemValue("item", "class", j), NT_Class, STS_Json.class, "" );
                        itemDetails["location"] = elegirSegmentacion( MANDATORY_LOCATION, transactionRecord.getLineItemValue("item", "location", j), NT_Location, STS_Json.location, "" );
                      }

                      if( STS_Json.accountgl == false || STS_Json.accountgl == "F" ) {

                        // Cuentas del Item y Transacción
                        if( filtroTransactionType == 1 ||filtroTransactionType == 2 ||filtroTransactionType == 10 ) {
                          // Invoice - Sales Order - Estimate
                          itemDetails["debitaccount"] = parseFloat( NT_ItemAccount ); // Cuenta del Item
                          itemDetails["creditaccount"] = parseFloat( transactionRecord.getFieldValue( "account" ) ); // Cuenta de la transacción
                        }

                        if( filtroTransactionType == 8 ) {
                          // Credit Memo
                          itemDetails["debitaccount"] = parseFloat( transactionRecord.getFieldValue( "account" ) ); // Cuenta de la Transacción
                          itemDetails["creditaccount"] = parseFloat( NT_ItemAccount ); // Cuenta del Item
                        }

                      } else {

                        // Cuentas del CC
                        if( filtroTransactionType == 1 ||filtroTransactionType == 2 ||filtroTransactionType == 10 ) {
                          // Invoice - Sales Order - Estimate
                          itemDetails["debitaccount"] = parseFloat( NT_debitAccount );
                          itemDetails["creditaccount"] = parseFloat( NT_creditAccount );
                        }

                        if( filtroTransactionType == 8 ) {
                          // Credit Memo
                          itemDetails["debitaccount"] = parseFloat( NT_creditAccount );
                          itemDetails["creditaccount"] = parseFloat( NT_debitAccount );
                        }

                      }

                      itemDetails["taxamount"] = itemTaxAmountByNT;
                      itemDetails["memo"] = " (LatamTax - National Tax) - (ID Item: " + itemID + ")";

                      if( STS_Json.summarizedgl == false || STS_Json.summarizedgl == "F" ) {
                        agregarLineas( customLines, book, itemDetails, 0, false, DEPARTMENT_LINE, CLASS_LINE );
                      } else {
                        itemArray.push( itemDetails );
                      }

                    }

                  }

                }
                // For de expenses solo para para Vendor Bill y Vendor Credit
                if( filtroTransactionType == 4 || filtroTransactionType == 7 ) {

                  for( var j = 1; j <= expenseLineCount; j++ ) {

                    var expenseAccountID = transactionRecord.getLineItemValue( "expense", "account", j );

                    var expenseNetAmount = transactionRecord.getLineItemValue( "expense", "amount", j );
                    var expenseTaxAmountByNT = Math.round( parseFloat(expenseNetAmount) * parseFloat(NT_taxRate) );

                    if( expenseTaxAmountByNT > 0 ) {

                      if( FEATURE_MULTIBOOK == true || FEATURE_MULTIBOOK == "T" ) {
                        expenseTaxAmountByNT = tipoCambioMB( transactionRecord, book, expenseTaxAmountByNT );
                      }

                      var expenseDetails = {};
                      expenseDetails["subtype"] = { text: NT_subType, value: NT_subTypeID };

                      if( STS_Json.depclassloc == true || STS_Json.depclassloc == "T" ) {
                        // Segmentación del CC
                        expenseDetails["department"] = elegirSegmentacion( MANDATORY_DEPARTMENT, NT_Department, transactionRecord.getLineItemValue("expense", "department", j), STS_Json.department, transactionRecord.getFieldValue("department") );
                        expenseDetails["class"] = elegirSegmentacion( MANDATORY_CLASS, NT_Class, transactionRecord.getLineItemValue("expense", "class", j), STS_Json.class, transactionRecord.getFieldValue("class") );
                        expenseDetails["location"] = elegirSegmentacion( MANDATORY_LOCATION, NT_Location, transactionRecord.getLineItemValue("expense", "location", j), STS_Json.location, transactionRecord.getFieldValue("location") );
                      } else {
                        // Segmentación del Expense
                        expenseDetails["department"] = elegirSegmentacion( MANDATORY_DEPARTMENT, transactionRecord.getLineItemValue("expense", "department", j), NT_Department, STS_Json.department, "" );
                        expenseDetails["class"] = elegirSegmentacion( MANDATORY_CLASS, transactionRecord.getLineItemValue("expense", "class", j), NT_Class, STS_Json.class, "" );
                        expenseDetails["location"] = elegirSegmentacion( MANDATORY_LOCATION, transactionRecord.getLineItemValue("expense", "location", j), NT_Location, STS_Json.location, "" );
                      }

                      if( STS_Json.accountgl == false || STS_Json.accountgl == "F" ) {

                        // Cuentas del Item y la Transaccion
                        if( filtroTransactionType == 7 ) {
                          // Bill Credit
                          expenseDetails["debitaccount"] = parseFloat( NT_ItemAccount ); // Cuenta del Item
                          expenseDetails["creditaccount"] = parseFloat( transactionRecord.getFieldValue("account") ); // Cuenta del transaccion
                        }
                        if( filtroTransactionType == 4 ) {
                          // Vendor Bill
                          expenseDetails["debitaccount"] = parseFloat( transactionRecord.getFieldValue("account") ); // Cuenta de la transaccion
                          expenseDetails["creditaccount"] = parseFloat( NT_ItemAccount ); // cuenta del Item
                        }

                      } else {

                        // Cuentas del CC
                        if( filtroTransactionType == 4 ) {
                          // Vendor Bill
                          expenseDetails["debitaccount"] = parseFloat( NT_debitAccount );
                          expenseDetails["creditaccount"] = parseFloat( NT_creditAccount );
                        }

                        if( filtroTransactionType == 7 ) {
                          // Vedor Credit
                          expenseDetails["debitaccount"] = parseFloat( NT_creditAccount );
                          expenseDetails["creditaccount"] = parseFloat( NT_debitAccount );
                        }

                      }

                      expenseDetails["taxamount"] = expenseTaxAmountByNT;
                      expenseDetails["memo"] = " (LatamTax - Contributory Class) - (ID Expense Account: " + expenseAccountID + ")";

                      if( STS_Json.summarizedgl == false || STS_Json.summarizedgl == "F" ) {
                        agregarLineas( customLines, book, expenseDetails, 0, false, DEPARTMENT_LINE, CLASS_LINE );
                      } else {
                        itemArray.push( expenseDetails );
                      }

                    }

                  }

                }

              }

            }

          }

        }

        /***********************************************************************
				 * Resumir las lineas calculadas para Items / Expenses
				 ***********************************************************************/
        if( STS_Json.summarizedgl == true || STS_Json.summarizedgl == "T" ) {

          var flag;
          if( itemArray != null && itemArray.length > 0 ) {

            for( var i = 0; i < itemArray.length; i++ ) {

              flag = false;
              var itemDetails = itemArray[i];
              var taxAmount = itemDetails.taxamount;

              for( var j = i + 1; j < itemArray.length; j++ ) {

                var itemDetailsAux = itemArray[j];
                var isGrouped = true;

                for ( var key in itemDetails ) {
                  if( key == "subtype" ) {
                    isGrouped = isGrouped && ( itemDetails[key].value == itemDetailsAux[key].value );
                  } else {
                    isGrouped = isGrouped && ( itemDetails[key] == itemDetailsAux[key] );
                  }
                }

                if( isGrouped ) {
                  taxAmount = parseFloat( taxAmount ) + parseFloat( itemDetailsAux.taxamount );
                  flag = true;
                  if( j == itemArray.length - 1 ) {
                    i = itemArray.length;
                  }
                } else {
                  i = j - 1;
                  break;
                }

              }

              agregarLineas( customLines, book, itemDetails, taxAmount, flag, DEPARTMENT_LINE, CLASS_LINE );

            }

          }

        }

      }

    }

  } catch (e) {
    nlapiLogExecution( "ERROR", "[ customizeGlImpact ]", e );
  }

}

/*******************************************************************************
 * Funcion que Agrega las Lineas al Suite GL
 * Parámetros :
 *    - customLines, book : parametro de la funcion principal
 *    - arregloLineas : arreglo que contiene todas las lineas
 *    - taxAmount : Monto del impuesto aplicado al item / expense
 *    - flagSum : False: No sumariza, True: Sumariza
 *    - prefDepLine, prefClassLine : configuracion de preferencias generales
 *******************************************************************************/
function agregarLineas( customLines, book, itemDetails, taxAmount, flagSum, prefDepLine, prefClassLine ) {

  try {

    var memo = "";
    if( flagSum == false ) {
      taxAmount = itemDetails.taxamount;
      memo = itemDetails.subtype.text + itemDetails.memo;
    } else {
      memo = itemDetails.subtype.text + " (Summarized - Items)";
    }

    // Linea para el Debit
    var newLineDebit = customLines.addNewLine();
    newLineDebit.setDebitAmount( taxAmount );
    newLineDebit.setAccountId( itemDetails.debitaccount );
    newLineDebit.setMemo( memo );

    if( itemDetails.department != null && itemDetails.department != "" && (prefDepLine == true || prefDepLine == "T") ) {
      newLineDebit.setDepartmentId( parseInt(itemDetails.department) );
    }
    if( itemDetails.class != null && itemDetails.class != "" && (prefClassLine == true || prefClassLine == "T") ) {
      newLineDebit.setClassId( parseInt(itemDetails.class) );
    }
    if( itemDetails.location != null && itemDetails.location != "" ) {
      newLineDebit.setLocationId( parseInt(itemDetails.location) );
    }

    newLineDebit.setEntityId( parseInt(entity) );

    // Linea para el Credit
    var newLineCredit = customLines.addNewLine();
    newLineCredit.setCreditAmount( taxAmount );
    newLineCredit.setAccountId( itemDetails.creditaccount );
    newLineCredit.setMemo( memo );

    if( itemDetails.department != null && itemDetails.department != "" && (prefDepLine == true || prefDepLine == "T") ) {
      newLineCredit.setDepartmentId( parseInt(itemDetails.department) );
    }
    if( itemDetails.class != null && itemDetails.class != "" && (prefClassLine == true || prefClassLine == "T") ) {
      newLineCredit.setClassId( parseInt(itemDetails.class) );
    }
    if( itemDetails.location != null && itemDetails.location != "" ) {
      newLineCredit.setLocationId( parseInt(itemDetails.location) );
    }

    newLineCredit.setEntityId( parseInt(entity) );

  } catch (e) {
    nlapiLogExecution( "ARROR", "[ agregarLineas ]", e );
  }

}

/*******************************************************************************
 * BUSQUEDA DEL RECORD: LATMAREADY - CONTRIBUTORY CLASS
 *    - subsidiary: Subsiaria
 *    - transactionDate: Fecha de creación de la transacción
 *    - filtroTransactionType: Invoice / Credit Memo
 *    - entity: ID de la Entidad
 *    - documentType: Tipo de Documento Fiscal
 *    - STS_Json: Configuración del record LatamReady - Setup Tax Subsidiary
 *******************************************************************************/
function getContributoryClasses ( subsidiary, transactionDate, filtroTransactionType, entityID, documentType, STS_Json ) {

  try {

    var filtrosCC = [
      [ "isinactive", "IS", "F" ], "AND",
      [ "custrecord_lmry_ar_ccl_fechdesd", "ONORBEFORE", transactionDate ], "AND",
      [ "custrecord_lmry_ar_ccl_fechhast", "ONORAFTER", transactionDate ], "AND",
      [ "custrecord_lmry_ccl_transactiontypes", "ANYOF", filtroTransactionType ], "AND",
      [ "custrecord_lmry_ar_ccl_entity", "ANYOF", entityID ], "AND",
      [ "custrecord_lmry_ccl_taxtype", "ANYOF", "4" ]
    ];

    if( filtroTransactionType == 1 || filtroTransactionType == 8 ) {
      filtrosCC.push( "AND", [ "custrecord_lmry_ccl_gen_transaction", "ANYOF", "6" ] );
    } else if( filtroTransactionType == 4 || filtroTransactionType == 7 ) {
      filtrosCC.push( "AND", [ "custrecord_lmry_ccl_gen_transaction", "ANYOF", "3" ] );
    }

    var documents = ["@NONE@"];
    if( documentType ) {
      documents.push( documentType );
    }
    filtrosCC.push( "AND", [ "custrecord_lmry_ccl_fiscal_doctype", "ANYOF", documents ] );

    if( FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T" ) {
      filtrosCC.push( "AND", [ "custrecord_lmry_ar_ccl_subsidiary", "ANYOF", subsidiary ] );
    }

    if( STS_Json.accountgl == true || STS_Json.accountgl == "T" ) {
      filtrosCC.push( "AND", [ "custrecord_lmry_br_ccl_account1", "NONEOF", "@NONE@" ] );
      filtrosCC.push( "AND", [ "custrecord_lmry_br_ccl_account2", "NONEOF", "@NONE@" ] );
    }

    var columnasCC = [];
    columnasCC[0] = new nlobjSearchColumn( "custrecord_lmry_ar_ccl_taxrate" );
    columnasCC[1] = new nlobjSearchColumn( "custrecord_lmry_sub_type" );
    columnasCC[2] = new nlobjSearchColumn( "custrecord_lmry_br_ccl_account1" );
    columnasCC[3] = new nlobjSearchColumn( "custrecord_lmry_br_ccl_account2" );
    columnasCC[4] = new nlobjSearchColumn( "custrecord_lmry_ar_ccl_department" );
    columnasCC[5] = new nlobjSearchColumn( "custrecord_lmry_ar_ccl_class" );
    columnasCC[6] = new nlobjSearchColumn( "custrecord_lmry_ar_ccl_location" );
    columnasCC[7] = new nlobjSearchColumn( "custrecord_lmry_ar_ccl_isexempt" );
    columnasCC[8] = new nlobjSearchColumn( "custrecord_lmry_cc_invoice_identifier" );

    if( filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 8 || filtroTransactionType == 10 ) {
      columnasCC[9] = new nlobjSearchColumn( "incomeaccount", "custrecord_lmry_ar_ccl_taxitem" );
    } else {
      columnasCC[9] = new nlobjSearchColumn( "expenseaccount", "custrecord_lmry_ar_ccl_taxitem" );
    }

    var searchCC = nlapiCreateSearch( "customrecord_lmry_ar_contrib_class", filtrosCC, columnasCC );
    var searchResultCC = searchCC.runSearch().getResults(0, 1000);

    // nlapiLogExecution( "ERROR", "[ Cantidad CC ]", searchResultCC.length );
    return searchResultCC;

  } catch (e) {
    nlapiLogExecution( "ERROR", "[ getContributoryClasses ]", e );
  }

}

/*******************************************************************************
 * BUSQUEDA DEL RECORD: LATMAREADY - NATIONAL TAX
 *    - subsidiary: Subsiaria
 *    - transactionDate: Fecha de creación de la transacción
 *    - filtroTransactionType: Invoice / Credit Memo
 *    - documentType: Tipo de Documento Fiscal
 *    - STS_Json: Configuración del record LatamReady - Setup Tax Subsidiary
 *******************************************************************************/
function getNationalTaxes( subsidiary, transactionDate, filtroTransactionType, documentType, STS_Json ) {

  try {

    var filtrosNT = [
      [ "isinactive", "IS", "F" ], "AND",
      [ "custrecord_lmry_ntax_datefrom", "ONORBEFORE", transactionDate ], "AND",
      [ "custrecord_lmry_ntax_dateto", "ONORAFTER", transactionDate ], "AND",
      [ "custrecord_lmry_ntax_transactiontypes", "ANYOF", filtroTransactionType ], "AND",
      [ "custrecord_lmry_ntax_taxtype", "ANYOF", "4" ]
    ];

    if( filtroTransactionType == 1 || filtroTransactionType == 8 ) {
      filtrosNT.push( "AND", [ "custrecord_lmry_ntax_gen_transaction", "ANYOF", "6" ] );
    } else if( filtroTransactionType == 4 || filtroTransactionType == 7 ) {
      filtrosNT.push( "AND", [ "custrecord_lmry_ntax_gen_transaction", "ANYOF", "3" ] );
    }

    var documents = [ "@NONE@" ];
    if( documentType ) {
      documents.push( documentType );
    }
    filtrosNT.push( "AND", [ "custrecord_lmry_ntax_fiscal_doctype", "ANYOF", documents ] );

    if( FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T" ) {
      filtrosNT.push( "AND", [ "custrecord_lmry_ntax_subsidiary", "ANYOF", subsidiary ] );
    }

    if( STS_Json.accountgl == true || STS_Json.accountgl ) {
      filtrosNT.push( "AND", [ "custrecord_lmry_ntax_debit_account", "NONEOF", "@NONE@" ] );
      filtrosNT.push( "AND", [ "custrecord_lmry_ntax_credit_account", "NONEOF", "@NONE@" ] );
    }

    var columnasNT = [];
    columnasNT[0] = new nlobjSearchColumn( "custrecord_lmry_ntax_taxrate" );
    columnasNT[1] = new nlobjSearchColumn( "custrecord_lmry_ntax_sub_type" );
    columnasNT[2] = new nlobjSearchColumn( "custrecord_lmry_ntax_debit_account" );
    columnasNT[3] = new nlobjSearchColumn( "custrecord_lmry_ntax_credit_account" );
    columnasNT[4] = new nlobjSearchColumn( "custrecord_lmry_ntax_department" );
    columnasNT[5] = new nlobjSearchColumn( "custrecord_lmry_ntax_class" );
    columnasNT[6] = new nlobjSearchColumn( "custrecord_lmry_ntax_location" );
    columnasCC[7] = new nlobjSearchColumn( "custrecord_lmry_ntax_isexempt" );
    columnasCC[8] = new nlobjSearchColumn( "custrecord_lmry_nt_invoicing_identifier" );

    if( filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 8 || filtroTransactionType == 10 ) {
      columnasNT[9] = new nlobjSearchColumn( "incomeaccount", "custrecord_lmry_ntax_taxitem" );
    } else {
      columnasNT[9] = new nlobjSearchColumn( "expenseaccount", "custrecord_lmry_ntax_taxitem" );
    }

    var searchNT = nlapiCreateSearch( "customrecord_lmry_national_taxes", filtrosNT, columnasNT );
    var searchResultNT = searchNT.runSearch().getResults(0, 1000);

    // nlapiLogExecution( "ERROR", "[ Cantidad NT ]", searchResultNT.length );
    return searchResultNT;

  } catch (e) {
    nlapiLogExecution( "ERROR", "[ getNationalTaxes ]", e );
  }

}

/*******************************************************************************
 * BUSQUEDA AL RECORD: LatamReaedy - Setup Tax Subsidiary
 *    - subsidiary: Subsidiary de la cual se requiere recuperar su configuración
 *******************************************************************************/
function getSetupTaxSubsidiary( subsidiary ) {

  try {

    var STS_Filters = [];
    STS_Filters.push( [ "isinactive", "IS", "F" ] );
    if( FEATURE_SUBSIDIARY ) {
      STS_Filters.push( "AND", [ "custrecord_lmry_setuptax_subsidiary", "IS", subsidiary ] );
    }

    var STS_Columns = [];
    STS_Columns[0] = new nlobjSearchColumn( "custrecord_lmry_setuptax_subsidiary" );
    STS_Columns[1] = new nlobjSearchColumn( "custrecord_lmry_setuptax_depclassloc" );
    STS_Columns[2] = new nlobjSearchColumn( "custrecord_lmry_setuptax_summarized_gl" );
    STS_Columns[3] = new nlobjSearchColumn( "custrecord_lmry_setuptax_account" );
    STS_Columns[4] = new nlobjSearchColumn( "custrecord_lmry_setuptax_department" );
    STS_Columns[5] = new nlobjSearchColumn( "custrecord_lmry_setuptax_class" );
    STS_Columns[6] = new nlobjSearchColumn( "custrecord_lmry_setuptax_location" );
    STS_Columns[7] = new nlobjSearchColumn( "custrecord_lmry_setuptax_currency" );

    var STS_Search = nlapiCreateSearch( "customrecord_lmry_setup_tax_subsidiary", STS_Filters, STS_Columns );
    var STS_SearchResult = STS_Search.runSearch().getResults(0, 1000);

    var STS_Json = {};
    if( STS_SearchResult != null && STS_SearchResult.length > 0 ) {

      STS_Json["subsidiary"] = STS_SearchResult[0].getValue( "custrecord_lmry_setuptax_subsidiary" );
      STS_Json["depclassloc"] = STS_SearchResult[0].getValue( "custrecord_lmry_setuptax_depclassloc" );
      STS_Json["summarizedgl"] = STS_SearchResult[0].getValue( "custrecord_lmry_setuptax_summarized_gl" );
      STS_Json["accountgl"] = STS_SearchResult[0].getValue( "custrecord_lmry_setuptax_account" );
      STS_Json["department"] = STS_SearchResult[0].getValue( "custrecord_lmry_setuptax_department" );
      STS_Json["class"] = STS_SearchResult[0].getValue( "custrecord_lmry_setuptax_class" );
      STS_Json["location"] = STS_SearchResult[0].getValue( "custrecord_lmry_setuptax_location" );
      STS_Json["currency"] = STS_SearchResult[0].getValue( "custrecord_lmry_setuptax_currency" );

    }
    // nlapiLogExecution( "ERROR", "[ TaxSubsidiary ]", JSON.stringify(STS_Json) );
    return STS_Json;

  } catch (e) {
    nlapiLogExecution( "ERROR", "[ getSetupTaxSubsidiary ]", e );
  }

}

/*******************************************************************************
 * OBTENCIÓN DEL EXCHAGERATE DE LA TRANSACCION O MILTIBOOK PARA LA CONVERSIÓN
 * A LA MONEDA BASE
 *******************************************************************************/
function getExchangeRate( transactionRecord, subsidiary, STS_Json ) {

  try {

    var exchangeRate = 1;
    var currency = transactionRecord.getFieldValue( "currency" );

    if( FEATURE_SUBSIDIARY && FEATURE_MULTIBOOK ) {

      var subsidiaryCurrency = nlapiLookupField( "subsidiary", subsidiary, "currency" );
      if( subsidiaryCurrency != STS_Json.currency && STS_Json.currency != "" && STS_Json.currency != null ) {

        var bookLineCount = transactionRecord.getLineItemCount( "accountingbookdetail" );
        if( bookLineCount != null && bookLineCount > 0 ) {
          for( var i = 1; i <= bookLineCount; i++ ) {

            var bookCurrency = transactionRecord.getLineItemValue( "accountingbookdetail", "currency", i );
            if( bookCurrency == STS_Json.currency ) {
              exchangeRate = transactionRecord.getLineItemValue( "accountingbookdetail", "exchangerate", i );
              break;
            }

          }
        }

      } else {
        exchangeRate = transactionRecord.getFieldValue( "exchangerate" );
      }

    } else {
      exchangeRate = transactionRecord.getFieldValue( "exchangerate" );
    }

    exchangeRate = parseFloat( exchangeRate );

    return exchangeRate;

  } catch (e) {
    nlapiLogExecution( "ERROR", "[ getExchangeRate ]", e );
  }

}

/*******************************************************************************
 * FUNCION QUE HACE LA CONVERSION A LA MONEDA DEL BOOK
 *    - transactionRecord: Record de la transacción
 *    - book: Libro bancario
 *    - taxAmount: Monto del impuesto
 *******************************************************************************/
function tipoCambioMB( transactionRecord, book, taxAmount ) {

  try {

    var bookExchangeRate = 1;
    if( book.isPrimary() ) {
      bookExchangeRate = transactionRecord.getFieldValue( "exchangerate" );
    }else {
      var bookID = book.getId();
      var bookLineCount = transactionRecord.getLineItemCount( "accountingbookdetail" );
      for( var i = 1; i <= bookLineCount; i++ ) {
        var accountingBookID = transactionRecord.getLineItemValue( "accountingbookdetail", "bookid", i );
        if( bookID == accountingBookID ) {
          bookExchangeRate = transactionRecord.getLineItemValue( "accountingbookdetail", "exchangerate", i );
          break;
        }
      }
    }

    taxAmount = parseFloat( taxAmount * parseFloat(bookExchangeRate) );

    return taxAmount;

  } catch (e) {
    nlapiLogExecution( "ERROR", "[ tipoCambioMB ]", e );
  }

}

/*******************************************************************************
 * Funcion que selecciona la segmentación de las líneas en el GL Impact dependiendo
 * de la configuración en el récord "LatamReady - Setup Tax Subsidiary"
 * Parámetros :
 *    - pref : segmentacion obligatoria en Preferencias Generales
 *    - valor1 / valor2 : Segmentacion de la transaccion o CC/NT segun configuracion
 *    - valorSetup : segmentación del Setup Tax Subsidiary
 *    - valorDefecto : segmentación de la transacción
 *******************************************************************************/
function elegirSegmentacion( pref, valor1, valor2, valorSetup, valorDefecto ) {

  try {

    if (valor1 != null && valor1 != "") {
      return valor1;
    } else {
      if (pref == "T" || pref == true) {
        if (valor2 == null || valor2 == "") {
          return valorSetup;
        } else {
          return valor2;
        }
      } else {
        if (valorDefecto != "" && valorDefecto != null) {
          return valorDefecto;
        }
      }
    }

    return "";

  } catch (e) {
    nlapiLogExecution( "ERROR", "[ elegirSegmentacion ]", e );
  }

}
