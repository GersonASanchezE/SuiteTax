/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
  ||  This script for customer center                             ||
  ||                                                              ||
  ||  File Name:  LMRY_NationalTaxes_URET_V2.0.js  	              ||
  ||                                                              ||
  ||  Version Date         Author        Remarks                  ||
  ||  2.0     Feb 08 2020  LatamReady    Bundle 37714             ||
   \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/ui/serverWidget', 'N/runtime', 'N/search', 'N/record', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0', './Latam_Library/LMRY_Log_LBRY_V2.0',
        './Latam_Library/LMRY_ST_CC_NT_ConfigFields_LBRY_V2.0'],
  function (log, serverWidget, runtime, search, record, libraryMail, libLog, ST_CC_NT_Library) {
    var LMRY_script = "LatamReady - National Taxes URET V2.0";
    var ST_FEATURE = false;
    function beforeLoad(context) {
      try {
        var form = context.form;
        var recordObj = context.newRecord;
        var type = context.type;

        var customSegments = [];

        var types = ["create", "copy", "edit", "view"];

        if (types.indexOf(type) != -1) {
          customSegments = createCustomSegmentFields(form);
          setCustomSegments(recordObj, form, customSegments);

          createBrTelecomCatalogField(recordObj, form);
        }

        if (type == 'view') {
          var fields = getFieldsToHide(recordObj);
          var viewFields = getViewFields(recordObj);
          showFieldsFromCheckBox(recordObj, viewFields, "custrecord_lmry_br_ntax_rate_suma", "custrecord_lmry_br_ntax_exclusive");
          showFieldsFromCheckBox(recordObj, viewFields, "custrecord_lmry_nt_reduction_ratio", "custrecord_lmry_nt_is_reduction");
          showBRLocationFields(recordObj, viewFields);
          showCustomSegmentFields(recordObj, viewFields, customSegments);

          log.error('viewFields', viewFields);
          hideFields(form, fields, viewFields);
        }
      } catch (err) {
        log.error("[ beforeLoad ]", err);
        libraryMail.sendemail(' [ beforeLoad ] ' + err, LMRY_script);
        libLog.doLog({ title: "[ beforeLoad ]", message: err });
      }
    }

    function beforeSubmit(context) {
      try {
        var type = context.type;
        if (runtime.executionContext == 'CSVIMPORT') {
          var types = ['create', 'edit', 'xedit'];
          if (types.indexOf(type) != -1) {
            var recordObj = context.newRecord;
            setTaxRate(recordObj);
          }
        }
      }
      catch (err) {
        log.error("[ beforeSubmit ]", err);
        libraryMail.sendemail(' [ beforeSubmit ] ' + err, LMRY_script);
        libLog.doLog({ title: "[ beforeSubmit ]", message: err });
      }
    }

    function afterSubmit(context) {
        try {
            ST_FEATURE = runtime.isFeatureInEffect({ feature: "tax_overhauling" });

            var recordObj = context.newRecord;
            var type = context.type;

            if (ST_FEATURE == true || ST_FEATURE == "T") {
                ST_CC_NT_Library.setTaxTypeAndTaxCodeBYNT(recordObj);
            }
        } catch (err) {
            log.error("[ afterSubmit ]", err);
            libraryMail.sendemail(' [ afterSubmit ] ' + err, LMRY_script);
            libLog.doLog({ title: "[ afterSubmit ]", message: err });
        }
    }

    function getViewFields(recordObj) {
      var viewFields = [];

      var country = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_subsidiary_country'
      });
      var gentrans = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_gen_transaction'
      });

      var taxtype = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_taxtype'
      });

      var whttype = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_subtype'
      });

      var subtype = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_sub_type'
      });

      var appliesto = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_appliesto'
      });

      if (country && taxtype && gentrans) {

        var filters = [
          ['isinactive', 'is', 'F'], 'AND',
          ['custrecord_lmry_setuptaxfield_record', 'is', '2'], 'AND',
          ['custrecord_lmry_setuptaxfield_country', 'anyof', country], 'AND',
          ['custrecord_lmry_setuptaxfield_taxtype', 'is', taxtype], 'AND',
          ['custrecord_lmry_setuptaxfield_genertrans', 'anyof', gentrans]
        ];


        var filterWhtType = (whttype) ? ['@NONE@', whttype] : ['@NONE@'];

        filters.push('AND', ['custrecord_lmry_setuptaxfield_wht_type', 'anyof', filterWhtType]);

        var filterSubtype = (subtype) ? ['@NONE@', subtype] : ['@NONE@'];

        filters.push('AND', ['custrecord_lmry_setuptaxfield_wht_subtyp', 'anyof', filterSubtype]);

        var filterAppliesTo = (appliesto) ? ['@NONE@', appliesto] : ['@NONE@'];

        filters.push('AND', ['custrecord_lmry_setuptaxfield_appliesto', 'anyof', filterAppliesTo]);

        var search_view = search.create({
          type: 'customrecord_lmry_setup_tax_fields_view',
          filters: filters,
          columns: ['internalid', 'name']
        });

        var results = search_view.run().getRange(0, 1000);

        if (results && results.length) {
          for (var i = 0; i < results.length; i++) {
            var name = results[i].getValue('name').trim();
            viewFields.push(name);
          }
        }
      }

      return viewFields;
    }

    function getFieldsToHide(recordObj) {
      var results = [];
      var fixedFields = [
        'custrecord_lmry_ntax_subsidiary', 'custrecord_lmry_ntax_subsidiary_country',
        'custrecord_lmry_ntax_transactiontypes', 'custrecord_lmry_ntax_gen_transaction', 'custrecord_lmry_ntax_taxtype']

      var rcord = record.create({
        type: 'customrecord_lmry_national_taxes'
      });

      var prefix = 'custrecord_';

      var fields = rcord.getFields();

      for (var i = 0; i < fields.length; i++) {
        var fieldName = fields[i];
        if ((fieldName.substring(0, prefix.length) == prefix && fixedFields.indexOf(fieldName) == -1)) {
          var field = recordObj.getField({
            fieldId: fieldName
          });

          if (field) {
            results.push(fieldName);
          }

        }
      }
      return results;
    }

    function hideFields(form, fields, viewFields) {
      for (var i = 0; i < fields.length; i++) {
        var fieldName = fields[i];
        if (viewFields.indexOf(fieldName) == -1) {
          var field = form.getField({
            id: fieldName
          });

          if (field) {
            field.updateDisplayType({
              displayType: serverWidget.FieldDisplayType.HIDDEN
            });
          }
        }
      }
    }

    function setTaxRate(recordObj) {
      var taxRate = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_taxrate'
      });

      var taxRatePercent = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_taxrate_pctge'
      });


      if (taxRate) {
        taxRate = parseFloat(taxRate);
        taxRatePercent = taxRate * 100;

        recordObj.setValue({
          fieldId: 'custrecord_lmry_ntax_taxrate_pctge',
          value: taxRatePercent
        });

      } else if (taxRatePercent) {
        taxRatePercent = parseFloat(taxRatePercent);
        taxRate = taxRatePercent / 100;

        recordObj.setValue({
          fieldId: 'custrecord_lmry_ntax_taxrate',
          value: taxRate
        });
      }

      var difalTaxRate = recordObj.getValue({
        fieldId: "custrecord_lmry_ntax_difal"
      });

      var difalTaxRatePrct = recordObj.getValue({
        fieldId: "custrecord_lmry_ntax_difal_pctge"
      });

      if (difalTaxRate) {
        difalTaxRate = parseFloat(difalTaxRate);
        difalTaxRatePrct = difalTaxRate * 100;
        recordObj.setValue({
          fieldId: "custrecord_lmry_ntax_difal_pctge",
          value: difalTaxRatePrct
        });
      } else if (difalTaxRatePrct) {
        difalTaxRatePrct = parseFloat(difalTaxRatePrct);
        difalTaxRate = difalTaxRatePrct / 100;

        recordObj.setValue({
          fieldId: "custrecord_lmry_ntax_difal",
          value: difalTaxRate
        });
      }
    }

    function showFieldsFromCheckBox(recordObj, viewFields, fields, parentField) {
      if (!Array.isArray(fields)) {
        fields = [fields];
      }
      var isActive = recordObj.getValue({ fieldId: parentField });
      if (isActive == true || isActive == "T") {
        for (var i = 0; i < fields.length; i++) {
          if (viewFields.indexOf(fields[i]) == -1) {
            viewFields.push(fields[i]);
          }
        }
      }
    }

    function showBRLocationFields(recordObj, viewFields) {
      var country = recordObj.getValue('custrecord_lmry_ntax_subsidiary_country');
      var subtype = recordObj.getValue('custrecord_lmry_ntax_sub_type');

      if (Number(country) == 30 && subtype) { //Brazil
        var isTaxByLocation = search.lookupFields({
          type: "customrecord_lmry_ar_wht_type",
          id: subtype,
          columns: ["custrecord_lmry_tax_by_location"]
        }).custrecord_lmry_tax_by_location;

        if (isTaxByLocation) {
          viewFields.push("custrecord_lmry_ntax_province", "custrecord_lmry_ntax_city", "custrecord_lmry_ntax_district");
        }
      }
    }

    function createCustomSegmentFields(form) {
      var customSegments = [];
      var FEAT_CUSTOMSEGMENTS = runtime.isFeatureInEffect({ feature: "customsegments" });
      if (FEAT_CUSTOMSEGMENTS == true || FEAT_CUSTOMSEGMENTS == 'T') {
        try {
          var segmentRecords = getCustomSegmentRecords();

          if (Object.keys(segmentRecords).length) {

            for (var s in segmentRecords) {
              var segmentId = s;
              var fieldId = 'custpage_' + segmentId;
              var field = form.addField({
                id: fieldId,
                label: segmentRecords[s].label,
                type: serverWidget.FieldType.SELECT
              });

              addCustomSegmentValues(field, "customrecord_" + segmentId);

              customSegments.push(segmentId);

              form.insertField({
                field: field,
                nextfield: "custrecord_lmry_ntax_config_segment"
              });
            }
          }

        } catch (err) {
          libraryMail.sendemail(' [ createCustomSegmentFields ] ' + err, LMRY_script);
        }
      }

      return customSegments;
    }


    function showCustomSegmentFields(recordObj, viewFields, customSegments) {
      var country = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_subsidiary_country'
      });
      var gentrans = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_gen_transaction'
      });

      var taxtype = recordObj.getValue({
        fieldId: 'custrecord_lmry_ntax_taxtype'
      });

      if (Number(country) == 30 && [2, 6].indexOf(Number(gentrans)) != -1 && [1, 4].indexOf(Number(taxtype)) != -1) { //Calculo de Impuestos BR
        for (var i = 0; i < customSegments.length; i++) {
          viewFields.push("custpage_" + customSegments[i]);
        }
      }
    }

    function setCustomSegments(recordObj, form, customSegments) {
      var stringObjSegments = recordObj.getValue({
        fieldId: "custrecord_lmry_ntax_config_segment"
      });

      if (stringObjSegments) {
        var objSegments = JSON.parse(stringObjSegments);

        for (var i = 0; i < customSegments.length; i++) {
          var segmentValue = objSegments[customSegments[i]];
          if (segmentValue) {
            var field = form.getField({
              id: "custpage_" + customSegments[i]
            });

            if (field && segmentValue) {
              field.defaultValue = segmentValue;
            }
          }
        }
      }
    }

    function getCustomSegmentRecords() {
      var segmentRecords = {};
      var searchSegmentRecords = search.create({
        type: "customrecord_lmry_setup_cust_segm",
        filters: [
          ["isinactive", "is", "F"]
        ],
        columns: [
          search.createColumn({
            name: "internalid",
            sort: search.Sort.ASC
          }),
          "name", "custrecord_lmry_setup_cust_segm"]
      });

      var results = searchSegmentRecords.run().getRange(0, 1000);

      for (var i = 0; i < results.length; i++) {
        var label = results[i].getValue("name") || "";
        label = label.trim();
        var segmentId = results[i].getValue("custrecord_lmry_setup_cust_segm") || "";
        segmentId = segmentId.trim();

        if (segmentId) {
          segmentRecords[segmentId] = { label: label }
        }
      }

      return segmentRecords;
    }

    function addCustomSegmentValues(customSegmentField, recordType) {
      var search_values = search.create({
        type: recordType,
        filters: [
          ["isinactive", "is", "F"]
        ],
        columns: ["internalid", "name"]
      });

      var results = search_values.run().getRange(0, 1000);
      customSegmentField.addSelectOption({ value: 0, text: '&nbsp;' });

      for (var i = 0; i < results.length; i++) {
        var id = results[i].getValue("internalid");
        var label = results[i].getValue("name");
        customSegmentField.addSelectOption({ value: id, text: label });
      }

    }

    function createBrTelecomCatalogField(recordObj, form) {
      try {
        var catalogField = form.addField({
          id: "custpage_br_nt_nfce_catalog",
          label: "Latam BR - NFCe Catalog",
          type: serverWidget.FieldType.SELECT,
          source: "customrecord_lmry_br_class_item"
        });

        form.insertField({
          field: catalogField,
          nextfield: "custrecord_lmry_ntax_applies_to_account"
        });

        var telecomCatalog = recordObj.getValue("custrecord_lmry_nt_nfce_catalog_id");
        if (telecomCatalog) {
          catalogField.defaultValue = telecomCatalog;
        }
      } catch (err) {
        log.error("[ createBrTelecomCatalogField ]", err);
        libLog.doLog({ title: "[ createBrTelecomCatalogField ]", message: err });
      }
    }

    return {
      beforeLoad: beforeLoad,
      beforeSubmit: beforeSubmit,
      afterSubmit: afterSubmit
    }
  });
