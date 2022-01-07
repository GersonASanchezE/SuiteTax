/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ST_CC_NT_ConfigFields_LBRY_V2.0.js		      ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Aug 12 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

define(['N/log', 'N/search', 'N/runtime', 'N/record', 'N/ui/message','./LMRY_libSendingEmailsLBRY_V2.0'],

  function(log, search, runtime, record, message, Library_Mail) {

    var LMRY_SCRIPT = "LMRY ST CC/NT Config Fields LBRY V2.0";

    var RECORD_TYPE = {
      "customrecord_lmry_ar_contrib_class": "1", // CONTRIBUTORY CLASS
      "customrecord_lmry_national_taxes": "2"    // NATIONAL TAXES
    };

    function disableTaxRateForPeru ( recordObj, detractionField, taxRateField ) {

      try {

        var detraction_concept = recordObj.getValue(detractionField);
        if(detraction_concept != "" && detraction_concept != null){
          recordObj.getField({
            fieldId: taxRateField
          }).isDisabled = true;
        }

      } catch (e) {
        Library_Mail.sendemail('[ disableTaxRateForPeru ]: ' + e, LMRY_SCRIPT);
      }

    }

    function setTaxRateByDetractionConceptForPeru ( recordObj, detractionField, taxRateField ) {

      try {

          var detraction_concept = recordObj.getValue(detractionField);
          if(detraction_concept != "" && detraction_concept != null){

            var DC_Search = search.lookupFields({
              type: 'customrecord_lmry_concepto_detraccion',
              id: detraction_concept,
              columns: ['custrecord_lmry_porcentaje_detraccion']
            });

            if(DC_Search != null && DC_Search.length > 0){

              var DC_TaxRate = DC_Search.custrecord_lmry_porcentaje_detraccion;
              if(DC_TaxRate != "" && DC_TaxRate != null){
                recordObj.setValue({ fieldId: taxRateField, value: parseFloat(DC_TaxRate), ignoreFieldChange: true });
              }else{
                recordObj.setValue({ fieldId: taxRateField, value: "", ignoreFieldChange: true });
              }

              recordObj.getField({
                fieldId: taxRateField
              }).isDisabled = true;

            }
          } else{

            recordObj.getField({
              fieldId: taxRateField
            }).isDisabled = false;

          }

      } catch (e) {
        Library_Mail.sendemail('[ setTaxRateByDetractionConceptForPeru ]: ' + e, LMRY_SCRIPT);
      }

    }

    function validateUniqueCCByInvoicingIdentifier ( recordObj ) {

      try {

        var language = runtime.getCurrentScript().getParameter({ name: "LANGUAGE" });
        language = language.substring(0, 2).toLowerCase();

        var CC_InvoicingIdentifier = recordObj.getValue({ fieldId: "custrecord_lmry_cc_invoice_identifier" });
        var CC_Subsidiary = recordObj.getValue({ fieldId: "custrecord_lmry_ar_ccl_subsidiary" });
        var CC_Entity = recordObj.getValue({ fieldId: "custrecord_lmry_ar_ccl_entity" });
        var CC_GeneratedTransaction = recordObj.getValue({ fieldId: "custrecord_lmry_ccl_gen_transaction" });
        var CC_Country = recordObj.getValue({ fieldId: "custrecord_lmry_ccl_subsidiary_country" });

        if (CC_Country != 30) {

            if (CC_GeneratedTransaction != 1 && CC_GeneratedTransaction != 5) {

                var CC_Search = search.create({
                  type: "customrecord_lmry_ar_contrib_class",
                  columns: [ "internalid" ],
                  filters: [
                      [ "custrecord_lmry_ar_ccl_entity", "anyof", CC_Entity ],
                      "AND",
                      [ "custrecord_lmry_ar_ccl_subsidiary", "anyof", CC_Subsidiary ],
                      "AND",
                      [ "custrecord_lmry_ccl_gen_transaction", "anyof", CC_GeneratedTransaction ],
                      "AND",
                      [ "custrecord_lmry_cc_invoice_identifier", "anyof", CC_InvoicingIdentifier ]
                  ]
                });
                var CC_SearchResult = CC_Search.run().getRange(0, 10);

                if( CC_SearchResult != null && CC_SearchResult.length > 0 ) {

                  var MESSAGE = {
                    "es": {
                      title: "Registro Duplicado",
                      message: 'Ya existe un Contributory Class configurado con el mismo \"Latam - Invoicing Identifier\"'
                    },
                    "en": {
                      title: "Duplicated Record",
                      message: 'There is already a Contributory Class configured with the same \"Latam - Invoicing Identifier\"'
                    },
                    "po": {
                      title: "Registro Duplicado",
                      message: 'Já existe um Contributory Class configurado com o mesmo \"Latam - Invoicing Identifier\"'
                    }
                  };

                  message.create({
                    title: MESSAGE[language].title,
                    message: MESSAGE[language].message,
                    type: message.Type.ERROR
                  }).show({ duration: 5000 });

                  return false;

                }

            }

        }

        return true;

      } catch (e) {
        Library_Mail.sendemail('[ validateUniqueCCByInvoicingIdentifier ]: ' + e, LMRY_SCRIPT);
      }

    }

    function validateUniqueNTByInvoicingIdentifier ( recordObj ) {

      try {

        var language = runtime.getCurrentScript().getParameter({ name: "LANGUAGE" });
        language = language.substring(0, 2).toLowerCase();

        var NT_InvoicingIdentifier = recordObj.getValue({ fieldId: "custrecord_lmry_nt_invoicing_identifier" });
        var NT_Subsidiary = recordObj.getValue({ fieldId: "custrecord_lmry_ntax_subsidiary" });
        var NT_GeneratedTransaction = recordObj.getValue({ fieldId: "custrecord_lmry_ntax_gen_transaction" });
        var NT_Country = recordObj.getValue({ fieldId: "custrecord_lmry_ntax_subsidiary_country" });

        if (NT_Country != 30) {

            if (NT_GeneratedTransaction != 1 && NT_GeneratedTransaction != 5) {

                var NT_Search = search.create({
                  type: "customrecord_lmry_national_taxes",
                  columns: [ "internalid" ],
                  filters: [
                      [ "custrecord_lmry_ntax_subsidiary", "anyof", NT_Subsidiary ],
                      "AND",
                      [ "custrecord_lmry_ntax_gen_transaction", "anyof", NT_GeneratedTransaction ],
                      "AND",
                      [ "custrecord_lmry_nt_invoicing_identifier", "anyof", NT_InvoicingIdentifier ]
                  ]
                });
                var NT_SearchResult = NT_Search.run().getRange(0, 10);

                if( NT_SearchResult != null && NT_SearchResult.length > 0 ) {

                  var MESSAGE = {
                    "es": {
                      title: "Registro Duplicado",
                      message: 'Ya existe un National Tax configurado con el mismo \"Latam - Invoicing Identifier\"'
                    },
                    "en": {
                      title: "Duplicated Record",
                      message: 'There is already a National Tax configured with the same \"Latam - Invoicing Identifier\"'
                    },
                    "po": {
                      title: "Registro Duplicado",
                      message: 'Já existe um National Tax configurado com o mesmo \"Latam - Invoicing Identifier\"'
                    }
                  };

                  message.create({
                    title: MESSAGE[language].title,
                    message: MESSAGE[language].message,
                    type: message.Type.ERROR
                  }).show({ duration: 5000 });

                  return false;

                }

            }

        }

        return true;

      } catch (e) {
        Library_Mail.sendemail('[ validateUniqueNTByInvoicingIdentifier ]: ' + e, LMRY_SCRIPT);
      }

    }

    /***************************************************************************
     * FUNCION QUE PERMITE AUTOCOMPLETAR EL TAX TYPE Y TAX CODE DEL CONTRIBUTORY
     * CLASS DESPUES DE QUE SE HAYA GUARDADO EL RECORD, ESTA FUNCION SERA
     * LLAMADA EN EL BEFORESUBMIT DEL USER EVENT DEL CONTRIBUTORY CLASS
     ***************************************************************************/
    function setTaxTypeAndTaxCodeBYCC (ST_RecordObj) {

        try {

            var CC_SubType = ST_RecordObj.getText({ fieldId: "custrecord_lmry_sub_type" });
            if (CC_SubType != null || CC_SubType != "") {

                var TaxCode_Search = search.create({
                    type: "salestaxitem",
                    columns: [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "custrecord_lmry_ste_setup_tax_type", label: "Latam - STE Setup Tax Type" })
                    ],
                    filters: [
                        search.createFilter({ name: "name", operator: "IS", values: CC_SubType })
                    ]
                }).run().getRange(0, 10);

                if (TaxCode_Search != null && TaxCode_Search.length > 0) {

                    record.submitFields({
                        type: "customrecord_lmry_ar_contrib_class",
                        id: ST_RecordObj.id,
                        values: {
                            custrecord_lmry_cc_ste_tax_type: TaxCode_Search[0].getValue({ name: "custrecord_lmry_ste_setup_tax_type" }),
                            custrecord_lmry_cc_ste_tax_code: TaxCode_Search[0].getValue({ name: "internalid" })
                        },
                        options: {
                            enableSourcing: true,
                            ignoreMandatoryFields: true,
                            disableTriggers: true
                        }
                    });

                }

            }

        } catch (e) {
            log.error('[ setTaxTypeAndTaxCodeBYCC ]', e);
            Library_Mail.sendemail('[ setTaxTypeAndTaxCodeBYCC ]: ' + e, LMRY_SCRIPT);
        }

    }

    return {
      disableTaxRateForPeru: disableTaxRateForPeru,
      setTaxRateByDetractionConceptForPeru: setTaxRateByDetractionConceptForPeru,
      validateUniqueCCByInvoicingIdentifier: validateUniqueCCByInvoicingIdentifier,
      validateUniqueNTByInvoicingIdentifier: validateUniqueNTByInvoicingIdentifier,
      setTaxTypeAndTaxCodeBYCC: setTaxTypeAndTaxCodeBYCC
    };

});
