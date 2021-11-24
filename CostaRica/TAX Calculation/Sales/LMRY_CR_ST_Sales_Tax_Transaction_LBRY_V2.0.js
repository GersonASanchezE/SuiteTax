/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */
/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||  This script for customer center (Time)                      ||
||                                                              ||
||  File Name: LMRY_ST_CR_Sales_Tax_Transaction_LBRY_V2.0.js    ||
||                                                              ||
||  Version Date              Author        Remarks             ||
||  2.0     NOV 02 2021       LatamReady    Use Script 2.0      ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
 define([
  "N/log",
  "N/record",
  "N/search",
  "N/runtime",
  "N/format",
  "N/ui/serverWidget",
  "./LMRY_libSendingEmailsLBRY_V2.0",
  "./LMRY_Log_LBRY_V2.0",
], function (
  log,
  record,
  search,
  runtime,
  format,
  serverWidget,
  Library_Mail,
  Library_Log
) {
  var LMRY_SCRIPT = "LMRY - CR ST Sales Tax Transaction V2.0";
  var LMRY_SCRIPT_NAME = "LMRY_CR_ST_Sales_Tax_Transaction_LBRY_V2.0.js";

  // FEATURES
  var FEATURE_SUBSIDIARY = false;
  var FEATURE_MULTIBOOK = false;

  /***************************************************************************
   * Desactivar invoiceing identifier: LATMAREADY - DISABLED INPUT           *
   ****************************************************************************/
  function disableInvoicingIdentifier(scriptContext) {
    try {
      var form = scriptContext.form;
      var Field_InvIdenti = form
        .getSublist({ id: "item" })
        .getField({ id: "custcol_lmry_invoicing_id" });
      Field_InvIdenti.updateDisplayType({
        displayType: serverWidget.FieldDisplayType.DISABLED,
      });
    } catch (error) {
      Library_Mail.sendemail(
        "[ beforeLoad - disableInvoicingIdentifier ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ beforeLoad - disableInvoicingIdentifier ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }
  /***************************************************************************
   * Funcion en donde se recuperan los impuestos de los Records Contributory *
   *    Class o National Tax para posteriormente realizar los calculos de    *
   *    impuestos.                                                           *
   ***************************************************************************/
  function setTaxTransaction(context) {
    try {
      var recordObj = context.newRecord;
      var actionType = context.type;

      var transactionID = recordObj.id;
      // Revisar el tipo de transaccion
      var transactionType = recordObj.type;

      // Validar si es alguna de estas acciones
      if (["create", "edit", "copy"].indexOf(actionType) != -1) {
        deleteTaxDetailLines(recordObj);
        // Capturar valos del checkBox
        var taxDetailOverride = recordObj.getValue({
          fieldId: "taxdetailsoverride",
        });
        // Validar si el checkBox esta activo
        if (taxDetailOverride == true || taxDetailOverride == "T") {
          FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({
            feature: "SUBSIDIARIES",
          });
          FEATURE_MULTIBOOK = runtime.isFeatureInEffect({
            feature: "MULTIBOOK",
          });
          var transactionSubsidiary = "";
          // Validar si el feature SUBSIDIARIES y MULTIBOOK esta activo
          if (FEATURE_SUBSIDIARY == true || FEATURE_MULTIBOOK == "T") {
            transactionSubsidiary = recordObj.getValue({
              fieldId: "subsidiary",
            });
          } else {
            // Si la subsidiaria tiene desactivados los features usar el valor
            // del campo LATAM - SUBSIDIARY COUNTRY
            transactionSubsidiary = recordObj.getValue({
              fieldId: "custbody_lmry_subsidiary_country",
            });
          }
          // Capturar el country de la subsidiary
          var transactionCountry = recordObj.getValue({
            fieldId: "custbody_lmry_subsidiary_country",
          });

          // Capturar la fecha
          var transactionDate = recordObj.getText({ fieldId: "trandate" });
          var transactionDateValue = recordObj.getValue({
            fieldId: "trandate",
          });
          // Capturar el customer
          var transactionEntity = recordObj.getValue({ fieldId: "entity" });
          // Capturar el tipo de documento
          // Puede estar vacio
          var transactionDocType = recordObj.getValue({
            fieldId: "custbody_lmry_document_type",
          });
          var filtroTransactionType = "";
          switch (transactionType) {
            case "invoice":
              filtroTransactionType = 1;
              break;
            case "creditmemo":
              filtroTransactionType = 8;
              break;
          }
          // Obtener informacion relacionada a la configuracion de impuestos en la subsidiaria
          var STS_JSON = _getSetupTaxSubsidiary(transactionSubsidiary);
          // Obtener tipo de cambio
          var exchangeRate = _getExchangeRate(
            recordObj,
            transactionSubsidiary,
            STS_JSON
          );
          // National Tax Result
          var NT_SearchResult = _getNationalTaxes(
            transactionSubsidiary,
            transactionDate,
            filtroTransactionType,
            transactionDocType
          );
          // Contributory Class Result
          var CC_SearchResult = _getContributoryClasses(
            transactionSubsidiary,
            transactionDate,
            filtroTransactionType,
            transactionEntity,
            transactionDocType
          );
          // Iniciar el proceso de calculo de impuestos para reporte
          var resultsTaxes = _startTax(
            recordObj,
            NT_SearchResult,
            CC_SearchResult,
            exchangeRate
          );
          if (resultsTaxes.length > 0) {
            // Guardar resultados en el record
            log.debug("resultsTaxes", resultsTaxes);
            _saveTaxResult(
              transactionID,
              transactionDateValue,
              transactionSubsidiary,
              transactionCountry,
              resultsTaxes
            );
          }
        }
      }
    } catch (error) {
      Library_Mail.sendemail(
        "[ afterSubmit - setTaxTransaction ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ afterSubmit - setTaxTransaction ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  /******************************************************************************
   * EMPEZAR A REALIZAR EL PROCESO DE CALCULO DE IMPUESTOS Y POSTERIOR GUARDADO *
   * NAME: LatamReady - STE TaxCode By Inv. Identif                             *
   * ACCESO: PRIVATE                                                            *
   * VARIABLES RECUPERADAS:                                                     *
   * - taxResult                                                                *
   ******************************************************************************/
  function _startTax(
    recordObj,
    NT_SearchResult,
    CC_SearchResult,
    exchangeRate
  ) {
    // Example: 2 lines
    var itemLineCount = recordObj.getLineCount({ sublistId: "item" });
    // Result
    var taxResult = [];
    // Objeto literal con informacion del taxtype, taxcode e invoicing
    var II_JSON = null;
    if (itemLineCount != "" && itemLineCount != 0) {
      // Iterator for tax result
      var lastDetailLine = 0;
      // Iterar los Line Fields
      for (var i = 0; i < itemLineCount; i++) {
        var item = recordObj.getSublistText({
          sublistId: "item",
          fieldId: "item",
          line: i,
        });
        var itemID = recordObj.getSublistValue({
          sublistId: "item",
          fieldId: "item",
          line: i,
        });
        var itemUniqueKey = recordObj.getSublistValue({
          sublistId: "item",
          fieldId: "lineuniquekey",
          line: i,
        });
        var itemInvoiceIdentifier = recordObj.getSublistText({
          sublistId: "item",
          fieldId: "custcol_lmry_taxcode_by_inv_ident",
          line: i,
        });
        var itemDetailReference = recordObj.getSublistValue({
          sublistId: "item",
          fieldId: "taxdetailsreference",
          line: i,
        });
        if (itemInvoiceIdentifier != null && itemInvoiceIdentifier != "") {
          II_JSON = _getInvoicingIdentifierJSON(itemInvoiceIdentifier);
        } else {
          // Si no se selecciona una opcion de impuestos
          // Se corta el proceso
          break;
        }
        // Si no tienes un precio establecio sera 0.0
        var itemNetAmount =
          recordObj.getSublistValue({
            sublistId: "item",
            fieldId: "amount",
            line: i,
          }) || 0.0;

        // Log de Contributory Classes
        log.debug("[ CC_SearchResult ]", CC_SearchResult);
        if (CC_SearchResult != null && CC_SearchResult.length > 0) {
          for (var j = 0; j < CC_SearchResult.length; j++) {
            var CC_internalID = CC_SearchResult[j].getValue({
              name: "internalid",
            });
            var CC_generatedTransaction = CC_SearchResult[j].getText({
              name: "custrecord_lmry_ccl_gen_transaction",
            });
            var CC_generatedTransactionID = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_ccl_gen_transaction",
            });
            var CC_taxType = CC_SearchResult[j].getText({
              name: "custrecord_lmry_ccl_taxtype",
            });
            var CC_taxTypeID = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_ccl_taxtype",
            });
            var CC_STE_taxType = CC_SearchResult[j].getText({
              name: "custrecord_lmry_cc_ste_tax_type",
            });
            var CC_STE_taxTypeID = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_cc_ste_tax_type",
            });
            var CC_STE_taxMemo = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_ar_ccl_memo",
            });
            var CC_STE_taxCode = CC_SearchResult[j].getText({
              name: "custrecord_lmry_cc_ste_tax_code",
            });
            var CC_STE_taxCodeID = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_cc_ste_tax_code",
            });
            var CC_taxRate = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_ar_ccl_taxrate",
            });
            var CC_isExempt = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_ar_ccl_isexempt",
            });
            var CC_invIdent = CC_SearchResult[j].getText({
              name: "custrecord_lmry_cc_invoice_identifier",
            });
            var CC_invIdentID = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_cc_invoice_identifier",
            });
            var CC_Department = CC_SearchResult[j].getText({
              name: "custrecord_lmry_ar_ccl_department",
            });
            var CC_DepartmentID = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_ar_ccl_department",
            });
            var CC_Class = CC_SearchResult[j].getText({
              name: "custrecord_lmry_ar_ccl_class",
            });
            var CC_ClassID = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_ar_ccl_class",
            });
            var CC_Location = CC_SearchResult[j].getText({
              name: "custrecord_lmry_ar_ccl_location",
            });
            var CC_LocationID = CC_SearchResult[j].getValue({
              name: "custrecord_lmry_ar_ccl_location",
            });

            // Comparar propiedad del record ItemInvoiceIdentifier
            // con el record del Contributory Class
            if (
              II_JSON.invoicing == CC_invIdent &&
              II_JSON.taxtype == CC_STE_taxType &&
              II_JSON.taxcode == CC_STE_taxCode
            ) {
              var itemTaxAmountByCC =
                parseFloat(itemNetAmount) * parseFloat(CC_taxRate);
              var itemGrossAmountByCC =
                parseFloat(itemNetAmount) + parseFloat(itemTaxAmountByCC);

              recordObj.setSublistValue({
                sublistId: "taxdetails",
                fieldId: "taxdetailsreference",
                line: lastDetailLine,
                value: itemDetailReference,
              });
              recordObj.setSublistValue({
                sublistId: "taxdetails",
                fieldId: "taxtype",
                line: lastDetailLine,
                value: CC_STE_taxTypeID,
              });
              recordObj.setSublistValue({
                sublistId: "taxdetails",
                fieldId: "taxcode",
                line: lastDetailLine,
                value: CC_STE_taxCodeID,
              });
              recordObj.setSublistValue({
                sublistId: "taxdetails",
                fieldId: "taxbasis",
                line: lastDetailLine,
                value: parseFloat(itemNetAmount),
              });
              recordObj.setSublistValue({
                sublistId: "taxdetails",
                fieldId: "taxrate",
                line: lastDetailLine,
                value: parseFloat(CC_taxRate) * 100,
              });
              recordObj.setSublistValue({
                sublistId: "taxdetails",
                fieldId: "taxamount",
                line: lastDetailLine,
                value: itemTaxAmountByCC,
              });

              taxResult.push({
                taxtype: {
                  text: CC_taxType,
                  value: CC_taxTypeID,
                },
                ste_taxtype: {
                  text: CC_STE_taxType,
                  value: CC_STE_taxTypeID,
                },
                ste_taxcode: {
                  text: CC_STE_taxCode,
                  value: CC_STE_taxCodeID,
                },
                lineuniquekey: itemUniqueKey,
                baseamount: parseFloat(itemNetAmount),
                taxamount: Math.round(itemTaxAmountByCC * 100) / 100,
                taxrate: CC_taxRate,
                cc_nt_id: CC_internalID,
                generatedtransaction: {
                  text: CC_generatedTransaction,
                  value: CC_generatedTransactionID,
                },
                department: {
                  text: CC_Department,
                  value: CC_DepartmentID,
                },
                class: {
                  text: CC_Class,
                  value: CC_ClassID,
                },
                location: {
                  text: CC_Location,
                  value: CC_LocationID,
                },
                item: {
                  text: item,
                  value: itemID,
                },
                expenseacc: {},
                position: i,
                description: CC_STE_taxMemo,
                lc_baseamount: parseFloat(itemNetAmount * exchangeRate),
                lc_taxamount: parseFloat(itemTaxAmountByCC * exchangeRate),
                lc_grossamount: parseFloat(itemGrossAmountByCC * exchangeRate),
              });

              lastDetailLine += 1;

              break;
            }
          } // FIN FOR CONTRIBUTORY CLASS
        } else {
          // Log de National Tax
          log.debug("[ NT_SearchResult ]", NT_SearchResult);
          if (NT_SearchResult != null && NT_SearchResult.length > 0) {
            for (var j = 0; j < NT_SearchResult.length; j++) {
              // OBTENER TODA LA INFORMACION DEL NATIONAL TAX
              var NT_internalID = NT_SearchResult[j].getValue({
                name: "internalid",
              });
              var NT_generatedTransaction = NT_SearchResult[j].getText({
                name: "custrecord_lmry_ntax_gen_transaction",
              });
              var NT_generatedTransactionID = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_ntax_gen_transaction",
              });
              var NT_taxType = NT_SearchResult[j].getText({
                name: "custrecord_lmry_ntax_taxtype",
              });
              var NT_taxTypeID = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_ntax_taxtype",
              });
              var NT_STE_taxType = NT_SearchResult[j].getText({
                name: "custrecord_lmry_nt_ste_tax_type",
              });
              var NT_STE_taxTypeID = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_nt_ste_tax_type",
              });
              var NT_STE_taxMemo = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_ntax_memo",
              });
              var NT_STE_taxCode = NT_SearchResult[j].getText({
                name: "custrecord_lmry_nt_ste_tax_code",
              });
              var NT_STE_taxCodeID = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_nt_ste_tax_code",
              });
              var NT_taxRate = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_ntax_taxrate",
              });
              var NT_isExempt = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_ntax_isexempt",
              });
              var NT_invIdent = NT_SearchResult[j].getText({
                name: "custrecord_lmry_nt_invoicing_identifier",
              });
              var NT_invIdentID = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_nt_invoicing_identifier",
              });
              var NT_Department = NT_SearchResult[j].getText({
                name: "custrecord_lmry_ntax_department",
              });
              var NT_DepartmentID = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_ntax_department",
              });
              var NT_Class = NT_SearchResult[j].getText({
                name: "custrecord_lmry_ntax_class",
              });
              var NT_ClassID = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_ntax_class",
              });
              var NT_Location = NT_SearchResult[j].getText({
                name: "custrecord_lmry_ntax_location",
              });
              var NT_LocationID = NT_SearchResult[j].getValue({
                name: "custrecord_lmry_ntax_location",
              });
              // COMPARAR CON EL IDENTIFIER TAXED
              log.debug({
                title: "Data",
                details: {
                  II_JSONinvoicing: II_JSON.invoicing,
                  NT_invIdent: NT_invIdent,
                  II_JSONTaxType: II_JSON.taxtype,
                  NT_STE_taxType: NT_STE_taxType,
                  II_JSONTaxCode: II_JSON.taxcode,
                  NT_STE_taxCode: NT_STE_taxCode,
                },
              });
              if (
                II_JSON.invoicing == NT_invIdent &&
                II_JSON.taxtype == NT_STE_taxType &&
                II_JSON.taxcode == NT_STE_taxCode
              ) {
                var itemTaxAmountByNT =
                  parseFloat(itemNetAmount) * parseFloat(NT_taxRate);
                var itemGrossAmountByNT =
                  parseFloat(itemNetAmount) + parseFloat(itemTaxAmountByNT);
                recordObj.setSublistValue({
                  sublistId: "taxdetails",
                  fieldId: "taxdetailsreference",
                  line: lastDetailLine,
                  value: itemDetailReference,
                });
                recordObj.setSublistValue({
                  sublistId: "taxdetails",
                  fieldId: "taxtype",
                  line: lastDetailLine,
                  value: NT_STE_taxTypeID,
                });
                recordObj.setSublistValue({
                  sublistId: "taxdetails",
                  fieldId: "taxcode",
                  line: lastDetailLine,
                  value: NT_STE_taxCodeID,
                });
                recordObj.setSublistValue({
                  sublistId: "taxdetails",
                  fieldId: "taxbasis",
                  line: lastDetailLine,
                  value: parseFloat(itemNetAmount),
                });
                recordObj.setSublistValue({
                  sublistId: "taxdetails",
                  fieldId: "taxrate",
                  line: lastDetailLine,
                  value: parseFloat(NT_taxRate) * 100,
                });
                recordObj.setSublistValue({
                  sublistId: "taxdetails",
                  fieldId: "taxamount",
                  line: lastDetailLine,
                  value: itemTaxAmountByNT,
                });
                taxResult.push({
                  taxtype: {
                    text: NT_taxType,
                    value: NT_taxTypeID,
                  },
                  ste_taxtype: {
                    text: NT_STE_taxType,
                    value: NT_STE_taxTypeID,
                  },
                  ste_taxcode: {
                    text: NT_STE_taxCode,
                    value: NT_STE_taxCodeID,
                  },
                  lineuniquekey: itemUniqueKey,
                  baseamount: parseFloat(itemNetAmount),
                  taxamount: Math.round(itemTaxAmountByNT * 100) / 100,
                  taxrate: NT_taxRate,
                  cc_nt_id: NT_internalID,
                  generatedtransaction: {
                    text: NT_generatedTransaction,
                    value: NT_generatedTransactionID,
                  },
                  department: {
                    text: NT_Department,
                    value: NT_DepartmentID,
                  },
                  class: {
                    text: NT_Class,
                    value: NT_ClassID,
                  },
                  location: {
                    text: NT_Location,
                    value: NT_LocationID,
                  },
                  item: {
                    text: item,
                    value: itemID,
                  },
                  expenseacc: {},
                  position: i,
                  description: NT_STE_taxMemo,
                  lc_baseamount: parseFloat(itemNetAmount * exchangeRate),
                  lc_taxamount: parseFloat(itemTaxAmountByNT * exchangeRate),
                  lc_grossamount: parseFloat(
                    itemGrossAmountByNT * exchangeRate
                  ),
                });
                lastDetailLine += 1;
                break;
              }
            }
          }
        }
      }
    }
    return taxResult;
  }

  /****************************************************************************
   * BUSQUEDA DEL RECORD: LATMAREADY - GET CONTRIBUTORY CLASSES               *
   ****************************************************************************/
  function _getContributoryClasses(
    subsidiary,
    transactionDate,
    filtroTransactionType,
    entity,
    documentType
  ) {
    try {
      var CC_Columns = [
        search.createColumn({ name: "internalid", label: "Internal ID" }),
        // metadata indicating the type of transaction
        search.createColumn({
          name: "custrecord_lmry_ccl_gen_transaction",
          label: "Latam - Generated Transacation?",
        }),
        /// Tax Type Setup
        search.createColumn({
          name: "custrecord_lmry_ccl_taxtype",
          label: "Latam - Tax Type",
        }),
        // Tax Type
        search.createColumn({
          name: "custrecord_lmry_cc_ste_tax_type",
          label: "Latam - STE Tax Type",
        }),
        // Tax Memo
        search.createColumn({
          name: "custrecord_lmry_ar_ccl_memo",
          label: "Latam - STE Tax Memo",
        }),
        // Tax Code
        search.createColumn({
          name: "custrecord_lmry_cc_ste_tax_code",
          label: "Latam - STE Tax Code",
        }),
        /// Applies to Lines or Total
        search.createColumn({
          name: "custrecord_lmry_ccl_appliesto",
          label: "Latam - Applies To",
        }),
        /// Tax Rate
        search.createColumn({
          name: "custrecord_lmry_ar_ccl_taxrate",
          label: "Latam - Tax Rate",
        }),
        /// Exempt tax
        search.createColumn({
          name: "custrecord_lmry_ar_ccl_isexempt",
          label: "Latam - Is Exempt?",
        }),
        /// Invoicing Identifier
        search.createColumn({
          name: "custrecord_lmry_cc_invoice_identifier",
          label: "Latam - Invoicing Identifier",
        }),
        /// Department
        search.createColumn({
          name: "custrecord_lmry_ar_ccl_department",
          label: "Latam - Department",
        }),
        /// Class
        search.createColumn({
          name: "custrecord_lmry_ar_ccl_class",
          label: "Latam - Class",
        }),
        /// Location
        search.createColumn({
          name: "custrecord_lmry_ar_ccl_location",
          label: "Latam - Location",
        }),
      ];

      var CC_Filters = [
        // Filter only active
        search.createFilter({
          name: "isinactive",
          operator: search.Operator.IS,
          values: ["F"],
        }),
        // Date init
        search.createFilter({
          name: "custrecord_lmry_ar_ccl_fechdesd",
          operator: search.Operator.ONORBEFORE,
          values: transactionDate,
        }),
        // Date limit
        search.createFilter({
          name: "custrecord_lmry_ar_ccl_fechhast",
          operator: search.Operator.ONORAFTER,
          values: transactionDate,
        }),
        // Tipo de transaccion al cual se aplica
        search.createFilter({
          name: "custrecord_lmry_ccl_transactiontypes",
          operator: search.Operator.ANYOF,
          values: filtroTransactionType,
        }),
        // Entidad relacionada a la transaccion
        search.createFilter({
          name: "custrecord_lmry_ar_ccl_entity",
          operator: search.Operator.ANYOF,
          values: entity,
        }),
        // 2: Lines
        // 1: Total
        search.createFilter({
          name: "custrecord_lmry_ccl_appliesto",
          operator: search.Operator.ANYOF,
          values: ["2"],
        }),
        //  1:Retencion, 2:Percepcion,
        //  3:Detraccion, 4:Calculo de Impuesto
        search.createFilter({
          name: "custrecord_lmry_ccl_taxtype",
          operator: search.Operator.ANYOF,
          values: ["4"],
        }),
        // 1:Journal, 2:SuiteGl, 3:LatamTax(Purchase),
        // 4:Add Line, 5: WhtbyTrans, LatamTax (Sales)
        search.createFilter({
          name: "custrecord_lmry_ccl_gen_transaction",
          operator: search.Operator.ANYOF,
          values: ["6"],
        }),
      ];

      // No sera requerido de document
      // En caso exista un asociado se tomara en cuenta
      var documents = ["@NONE@"];
      if (documentType) {
        documents.push(documentType);
      }
      CC_Filters.push(
        search.createFilter({
          // Document
          name: "custrecord_lmry_ccl_fiscal_doctype",
          operator: search.Operator.ANYOF,
          values: documents,
        })
      );

      if (FEATURE_SUBSIDIARY === true || FEATURE_SUBSIDIARY === "T") {
        CC_Filters.push(
          //
          search.createFilter({
            name: "custrecord_lmry_ar_ccl_subsidiary",
            operator: search.Operator.ANYOF,
            values: subsidiary,
          })
        );
      }

      var searchCC = search
        .create({
          type: "customrecord_lmry_ar_contrib_class",
          columns: CC_Columns,
          filters: CC_Filters,
        })
        .run()
        .getRange(0, 1000);

      return searchCC;
    } catch (error) {
      Library_Mail.sendemail(
        "[ afterSubmit - getContributoryClasses ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ afterSubmit - getContributoryClasses ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  /***************************************************************************
   * BUSQUEDA DEL RECORD: LATMAREADY - GET NATIONAL TAXES                    *
   ***************************************************************************/
  function _getNationalTaxes(
    subsidiary,
    transactionDate,
    filtroTransactionType,
    documentType
  ) {
    try {
      var NT_Columns = [
        search.createColumn({ name: "internalid", label: "Internal ID" }),
        // tipo de subsidiaria
        search.createColumn({
          name: "custrecord_lmry_ntax_sub_type",
          label: "Latam - Sub Type",
        }),
        // impuesto aplicado al total o a cada linea
        search.createColumn({
          name: "custrecord_lmry_ntax_appliesto",
          label: "Latam - Applies To",
        }),
        // Tax Memo
        search.createColumn({
          name: "custrecord_lmry_ntax_memo",
          label: "Latam - STE Tax Memo",
        }),
        // tipo de impuesto
        search.createColumn({
          name: "custrecord_lmry_ntax_taxtype",
          label: "Latam - Tax Type",
        }),
        // porcentaje de impuesto
        search.createColumn({
          name: "custrecord_lmry_ntax_taxrate",
          label: "Latam - Tax Rate",
        }),
        // Exento de impuestos o no
        search.createColumn({
          name: "custrecord_lmry_ntax_isexempt",
          label: "Latam - Is Exempt?",
        }),
        // Invoicing identifier
        search.createColumn({
          name: "custrecord_lmry_nt_invoicing_identifier",
          label: "Latam - Invoicing Identifier",
        }),
        // lista de departamentos
        search.createColumn({
          name: "custrecord_lmry_ntax_department",
          label: "Latam - Department",
        }),
        // lista de clases
        search.createColumn({
          name: "custrecord_lmry_ntax_class",
          label: "Latam - Class",
        }),
        // lista de locaciones
        search.createColumn({
          name: "custrecord_lmry_ntax_location",
          label: "Latam - Location",
        }),
        // cuenta de credito
        search.createColumn({
          name: "custrecord_lmry_ntax_credit_account",
          label: "Latam - Credit Account",
        }),
        // cuenta de debito
        search.createColumn({
          name: "custrecord_lmry_ntax_debit_account",
          label: "Latam - Debit Account",
        }),
        // gen de transaccion
        search.createColumn({
          name: "custrecord_lmry_ntax_gen_transaction",
          label: "Latam - Generated Transacation?",
        }),
        // Tax type
        search.createColumn({
          name: "custrecord_lmry_nt_ste_tax_type",
          label: "Latam - STE Tax Type",
        }),
        // Tax Code
        search.createColumn({
          name: "custrecord_lmry_nt_ste_tax_code",
          label: "Latam - STE Tax Code",
        }),
      ];

      var NT_Filters = [
        search.createFilter({
          name: "isinactive",
          operator: search.Operator.IS,
          values: ["F"],
        }),
        // Date
        search.createFilter({
          name: "custrecord_lmry_ntax_datefrom",
          operator: search.Operator.ONORBEFORE,
          values: transactionDate,
        }),
        // DATE
        search.createFilter({
          name: "custrecord_lmry_ntax_dateto",
          operator: search.Operator.ONORAFTER,
          values: transactionDate,
        }),
        // Tipo de transaccion
        search.createFilter({
          name: "custrecord_lmry_ntax_transactiontypes",
          operator: search.Operator.ANYOF,
          values: filtroTransactionType,
        }),
        // Impuesto aplicado al total o a cada linea
        // 2:Lines
        // 1:Total
        search.createFilter({
          name: "custrecord_lmry_ntax_appliesto",
          operator: search.Operator.ANYOF,
          values: ["2"],
        }),
        // Tipo de impuesto
        // 4:Calculo de Impuestos
        // 3:Detraccion
        // 2:Percepcion
        // 1:Retencion
        search.createFilter({
          name: "custrecord_lmry_ntax_taxtype",
          operator: "ANYOF",
          values: ["4"],
        }),
        // 1:Journal, 2:SuiteGL
        // 3:Latam Tax (Purchase)
        // 4:Add Line
        // 5: WHT by Transaction
        // 6:Latam Tax (Sales)
        search.createFilter({
          name: "custrecord_lmry_ntax_gen_transaction",
          operator: "ANYOF",
          values: ["6"],
        }),
      ];

      var documents = ["@NONE@"];
      if (documentType) {
        // Si se establece un tipo de documento fiscal, se filtra por este  tipo
        documents.push(documentType);
      }
      NT_Filters.push(
        search.createFilter({
          name: "custrecord_lmry_ntax_fiscal_doctype",
          operator: "ANYOF",
          values: documents,
        })
      );

      if (FEATURE_SUBSIDIARY === true || FEATURE_SUBSIDIARY === "T") {
        // Si la subsidiaria tiene activado la liscence
        NT_Filters.push(
          search.createFilter({
            name: "custrecord_lmry_ntax_subsidiary",
            operator: "ANYOF",
            values: subsidiary,
          })
        );
      }
      // Buscando los record que conincida
      var searchNT = search
        .create({
          type: "customrecord_lmry_national_taxes",
          columns: NT_Columns,
          filters: NT_Filters,
        })
        .run()
        .getRange(0, 1000);

      return searchNT;
    } catch (e) {
      Library_Mail.sendemail(
        "[ afterSubmit - getNationalTaxes ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ afterSubmit - getNationalTaxes ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  /***************************************************************************
   * SEPARAR EN VARIABLES EL DATO RECUPERADO DEL RECORD                      *
   * NAME: LatamReady - STE TaxCode By Inv. Identif                          *
   * ACCESO: PRIVATE                                                         *
   * VARIABLES RECUPERADAS:                                                  *
   * - Tax Type                                                              *
   * - Tax Code                                                              *
   * - Invoicing                                                             *
   ***************************************************************************/
  function _getInvoicingIdentifierJSON(invoicingIdentifier) {
    try {
      if (invoicingIdentifier == null || invoicingIdentifier == undefined) {
        return {
          taxtype: null,
          taxcode: null,
          invoicing: null,
        };
      }
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
      Library_Mail.sendemail(
        "[ afterSubmit - getInvoicingIdentifierJSON ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ afterSubmit - getInvoicingIdentifierJSON ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  /***************************************************************************
   * GUARDAR UN REGISTRO EN EL RECORD: LATMAREADY - LATAMTAX TAX RESULT      *
   *    - recordID: ID de la transacción                                     *
   *    - subsidiary: ID de la subsidiaria                                   *
   *    - countryID: ID del país                                             *
   *    - taxResult: Arreglo de JSON con los detalles de impuestos           *
   ****************************************************************************/
  function _saveTaxResult(
    recordID,
    tranDate,
    subsidiary,
    countryID,
    taxResult
  ) {
    try {
      // Parsed date
      /*  tranDate = tranDate.toISOString();
      tranDate = new Date(tranDate);
      tranDate = format.format({ value: tranDate, type: format.Type.DATE }); */
      // end parsed date
      var taxResultSearch = search
        .create({
          // Actual
          type: "customrecord_lmry_ste_json_result",
          // Antiguo
          // type: "customrecord_lmry_latamtax_tax_result",
          columns: ["internalid"],

          filters: [
            // Actual
            ["custrecord_lmry_ste_related_transaction", "IS", recordID],
            // Antiguo
            // ["custrecord_lmry_tr_related_transaction", "IS", recordID]
          ],
        })
        .run()
        .getRange(0, 10);

      if (taxResultSearch !== null && taxResultSearch.length > 0) {
        var taxResultID = taxResultSearch[0].getValue({ name: "internalid" });

        record.submitFields({
          // Actual
          type: "customrecord_lmry_ste_json_result",
          // Antiguo
          // type: "customrecord_lmry_latamtax_tax_result",
          id: taxResultID,
          values: {
            // Actual
            custrecord_lmry_ste_subsidiary: subsidiary,
            // Antiguo
            // custrecord_lmry_tr_subsidiary: subsidiary,
            // Actual
            custrecord_lmry_ste_subsidiary_country: countryID,
            // Antiguo
            // custrecord_lmry_tr_country: countryID,
            // Actual
            custrecord_lmry_ste_tax_transaction: JSON.stringify(taxResult),
            // Antiguo
            // custrecord_lmry_tr_tax_transaction: JSON.stringify(taxResult),
            // Nuevo
            custrecord_lmry_ste_transaction_date: tranDate,
          },
          options: {
            enableSourcing: false,
            ignoreMandatoryFields: true,
          },
        });
      } else {
        var TR_Record = record.create({
          // Actual
          type: "customrecord_lmry_ste_json_result",
          // Antiguo
          // type: "customrecord_lmry_latamtax_tax_result",
          isDynamic: false,
        });
        TR_Record.setValue({
          // Actual
          fieldId: "custrecord_lmry_ste_related_transaction",
          // Anterior value
          // fieldId: "custrecord_lmry_tr_related_transaction",
          value: recordID,
        });
        TR_Record.setValue({
          // Actual
          fieldId: "custrecord_lmry_ste_subsidiary",
          // Anterior value
          // fieldId: "custrecord_lmry_tr_subsidiary",
          value: subsidiary,
        });
        TR_Record.setValue({
          // Actual
          fieldId: "custrecord_lmry_ste_subsidiary_country",
          // Anterior value
          // fieldId: "custrecord_lmry_tr_country",
          value: countryID,
        });
        // Nuevo
        TR_Record.setValue({
          fieldId: "custrecord_lmry_ste_transaction_date",
          value: tranDate,
        });
        TR_Record.setValue({
          // Actual
          fieldId: "custrecord_lmry_ste_tax_transaction",
          // Anterior value
          // fieldId: "custrecord_lmry_tr_tax_transaction",
          value: JSON.stringify(taxResult),
        });

        var recordSave = TR_Record.save({
          enableSourcing: true,
          ignoreMandatoryFields: true,
          disableTriggers: true,
        });
      }
    } catch (error) {
      Library_Mail.sendemail(
        "[ afterSubmit - saveTaxResult ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ adterSubmit - saveTaxResult ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  /****************************************************************************
   * BUSQUEDA DEL RECORD: LATMAREADY - SETUP TAX SUBSIDIARY                   *
   *    - subsidiary: Subsiaria a filtrar para recuperar su configuración     *
   ****************************************************************************/
  function _getSetupTaxSubsidiary(subsidiary) {
    try {
      var STS_Columns = [
        // Subsidiaria
        search.createColumn({
          name: "custrecord_lmry_setuptax_subsidiary",
          label: "Latam - Subsidiary",
        }),
        // Currency
        search.createColumn({
          name: "custrecord_lmry_setuptax_currency",
          label: "Latam - Currency",
        }),
        // Dep, Class, Location
        search.createColumn({
          name: "custrecord_lmry_setuptax_depclassloc",
          label: "Latam - Department, Class & Location",
        }),
        // deparment
        search.createColumn({
          name: "custrecord_lmry_setuptax_department",
          label: "Latam - Department",
        }),
        // class
        search.createColumn({
          name: "custrecord_lmry_setuptax_class",
          label: "Latam - Class",
        }),
        // location
        search.createColumn({
          name: "custrecord_lmry_setuptax_location",
          label: "Latam - Location",
        }),
        // tax code
        search.createColumn({
          name: "taxtype",
          join: "custrecord_lmry_setuptax_tax_code",
          label: "Latam - Tax Type",
        }),
        // tax code
        search.createColumn({
          name: "custrecord_lmry_setuptax_tax_code",
          label: "Latam - Tax Code",
        }),
      ];

      var STS_Filters = [
        search.createFilter({
          name: "isinactive",
          operator: search.Operator.IS,
          values: "F",
        }),
      ];

      if (FEATURE_SUBSIDIARY === true || FEATURE_SUBSIDIARY === "T") {
        STS_Filters.push(
          search.createFilter({
            name: "custrecord_lmry_setuptax_subsidiary",
            operator: search.Operator.ANYOF,
            values: subsidiary,
          })
        );
      }

      var setupTaxSubsidiarySearch = search
        .create({
          type: "customrecord_lmry_setup_tax_subsidiary",
          columns: STS_Columns,
          filters: STS_Filters,
        })
        .run()
        .getRange(0, 10);

      // Guardar todos los datos del search en un objeto
      // Estructura llave valor
      var setupTaxSubsidiary = {};
      if (setupTaxSubsidiarySearch && setupTaxSubsidiarySearch.length > 0) {
        var columns = setupTaxSubsidiarySearch[0].columns;
        setupTaxSubsidiary["subsidiary"] = setupTaxSubsidiarySearch[0].getValue(
          { name: "custrecord_lmry_setuptax_subsidiary" }
        );
        setupTaxSubsidiary["currency"] = setupTaxSubsidiarySearch[0].getValue({
          name: "custrecord_lmry_setuptax_currency",
        });
        setupTaxSubsidiary["depclassloc"] =
          setupTaxSubsidiarySearch[0].getValue({
            name: "custrecord_lmry_setuptax_depclassloc",
          });
        setupTaxSubsidiary["department"] = setupTaxSubsidiarySearch[0].getValue(
          { name: "custrecord_lmry_setuptax_department" }
        );
        setupTaxSubsidiary["class"] = setupTaxSubsidiarySearch[0].getValue({
          name: "custrecord_lmry_setuptax_class",
        });
        setupTaxSubsidiary["location"] = setupTaxSubsidiarySearch[0].getValue({
          name: "custrecord_lmry_setuptax_location",
        });
        setupTaxSubsidiary["taxtype"] = setupTaxSubsidiarySearch[0].getValue(
          setupTaxSubsidiarySearch[0].columns[6]
        );
        setupTaxSubsidiary["taxcode"] = setupTaxSubsidiarySearch[0].getValue({
          name: "custrecord_lmry_setuptax_tax_code",
        });
      }

      return setupTaxSubsidiary;
    } catch (error) {
      Library_Mail.sendemail(
        "[ afterSubmit - getSetupTaxSubsidiary ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ afterSubmit - getSetupTaxSubsidiary ] ",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  /*******************************************************************************
   * FUNCION PARA OBTENER EL TIPO DE CAMBIO CON EL QUE SE VAN A REALIZAR LOS     *
   * CALLCULOS DE IMPUESTOS                                                      *
   *    - recordObj: Registro de la transaccion                                  *
   *    - subsidiary: Subsidiaria de transaccion                                 *
   *    - STS_JSON: Json con campos del record LatamReady - Setup Tax Subsidiary *
   *    - STS_JSON.currency: Moneda de subsidiaria                               *
   *******************************************************************************/
  function _getExchangeRate(recordObj, subsidiary, STS_JSON) {
    try {
      // Recuperar el tipo de cambio
      var transactionExchangeRate = recordObj.getValue({
        fieldId: "exchangerate",
      });

      var exchangeRate = 1;
      if (
        (FEATURE_SUBSIDIARY === true || FEATURE_SUBSIDIARY === "T") &&
        (FEATURE_MULTIBOOK === true || FEATURE_MULTIBOOK === "T")
      ) {
        var subsiadiarySearch = search.lookupFields({
          type: "subsidiary",
          id: subsidiary,
          columns: ["currency"],
        });

        var subsidiaryCurrency = subsiadiarySearch.currency[0].value;
        log.debug({
          title: "ExChangeRate",
          details: {
            transactionExchangeRate: transactionExchangeRate,
            subsidiaryCurrency: subsidiaryCurrency,
            STS_JSON: STS_JSON,
            currency: STS_JSON.currency,
          },
        });
        if (
          subsidiaryCurrency !== STS_JSON.currency &&
          STS_JSON.currency !== "" &&
          STS_JSON.currency != null
        ) {
          var bookLineCount = recordObj.getLineCount({
            sublistId: "accountingbookdetail",
          });
          if (bookLineCount !== "" && bookLineCount !== null) {
            for (var i = 0; i < bookLineCount; i++) {
              var bookCurrency = recordObj.getSublistValue({
                sublistId: "accountingbookdetail",
                fieldId: "currency",
                line: i,
              });
              if (bookCurrency === STS_JSON.currency) {
                exchangerate = recordObj.getSublistValue({
                  sublistId: "accountingbookdetail",
                  fieldId: "exchangerate",
                  line: i,
                });
                break;
              }
            }
          }
        } else {
          exchangeRate = transactionExchangeRate;
        }
      } else {
        exchangeRate = transactionExchangeRate;
      }

      return exchangeRate;
    } catch (error) {
      Library_Mail.sendemail(
        "[ afterSubmit - getExchangeRate ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ afterSubmit - getExchangeRate ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  /***************************************************************************
   * FUNCTION PARA ELIMINAR EL TAX RESULT RELACIONADO A LA TRANSACCION
   * DESPUES DE QUE ESTA HAYA SIDO ELIMINADA
   *    - recordObj: Transaccion
   ***************************************************************************/
  function deleteTaxResult(recordObj) {
    try {
      var taxResultSeach = search
        .create({
          // Actual
          type: "customrecord_lmry_ste_json_result",
          // Antiguo
          // type: "customrecord_lmry_latamtax_tax_result",
          columns: ["internalid"],
          filters: [
            // Actual
            ["custrecord_lmry_ste_related_transaction", "IS", recordObj],
            // Anterior
            // ["custrecord_lmry_tr_related_transaction", "IS", recordObj],
          ],
        })
        .run()
        .getRange(0, 10);

      if (taxResultSeach != null && taxResultSeach.length > 0) {
        var taxResultID = taxResultSeach[0].getValue({ name: "internalid" });
        record.delete({
          // Actual
          type: "customrecord_lmry_ste_json_result",
          // Antiguo
          // type: "customrecord_lmry_latamtax_tax_result",
          id: taxResultID,
        });
      }
    } catch (error) {
      Library_Mail.sendemail(
        "[ beforeSubmit - deleteTaxResult ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ beforeSubmit - deleteTaxResult ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  /***************************************************************************
   * FUNCION PARA PARA ELIMINAR LAS LINEAS DE LA TRANSACCION NUEVA CUANDO SE
   * HACE UN MAKE COPY
   *    - recordObj: Transaccion
   ***************************************************************************/
  function deleteTaxDetailLines(recordObj) {
    try {
      var taxDetailLines = recordObj.getLineCount({ sublistId: "taxdetails" });
      if (taxDetailLines != null && taxDetailLines > 0) {
        for (var i = taxDetailLines - 1; i >= 0; i--) {
          recordObj.removeLine({ sublistId: "taxdetails", line: i });
        }
      }
    } catch (error) {
      Library_Mail.sendemail(
        "[ beforeLoad - deleteTaxDetailLines ]: " + error,
        LMRY_SCRIPT
      );
      Library_Log.doLog({
        title: "[ beforeLoad - deleteTaxDetailLines ]",
        message: error,
        relatedScript: LMRY_SCRIPT_NAME,
      });
    }
  }

  return {
    disableInvoicingIdentifier: disableInvoicingIdentifier,
    setTaxTransaction: setTaxTransaction,
    deleteTaxResult: deleteTaxResult,
    deleteTaxDetailLines: deleteTaxDetailLines,
  };
});
