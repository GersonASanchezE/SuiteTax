/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_MX_AutoSet_TaxDetails_CLNT_V2.0.js          ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Apl 30 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/search', 'N/record'],

function(log, search, record) {

    /**
     * Function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.line - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.column - Line number. Will be undefined if not a matrix field
     *
     * @since 2015.2
     */
    function fieldChanged(scriptContext) {

      try {

        var currentRecord = scriptContext.currentRecord;
        var currentLine = scriptContext.line;
        var sublistId = scriptContext.sublistId;

        if (sublistId === "taxdetails") {

          var lineType = currentRecord.getCurrentSublistValue({ sublistId: sublistId, fieldId: "linetype" }).toLowerCase();
          var netAmount = currentRecord.getCurrentSublistValue({ sublistId: sublistId, fieldId: "netamount" });

          if (lineType !== "" && netAmount !== "") {

            var taxCode = currentRecord.getCurrentSublistValue({ sublistId: sublistId, fieldId: "taxcode" });
            if (taxCode) {

              var taxRate = getTaxCodeRate(taxCode);
              if(taxRate != "Not-Found") {

                currentRecord.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxbasis", value: parseFloat(netAmount), ignoreFieldChange: true });
                currentRecord.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxrate", value: parseFloat(taxRate), ignoreFieldChange: true });
                currentRecord.setCurrentSublistValue({ sublistId: "taxdetails", fieldId: "taxamount", value: parseFloat((netAmount * taxRate)/100), ignoreFieldChange: true });

              }

            }

          }

        }

        return true;

      } catch (e) {
        log.error('[ AutoSet Tax Details - fieldChanged ]', e);
      }

    }

    function getTaxCodeRate(taxCode) {

      var taxCodeSearch = search.lookupFields({
        type: 'salestaxitem',
        id: taxCode,
        columns: ["custrecord_lmry_tax_code_fields_json"]
      });

      if(taxCodeSearch != null && taxCodeSearch) {

        var taxCodeJSON = JSON.parse(taxCodeSearch.custrecord_lmry_tax_code_fields_json);

        return taxCodeJSON.taxrate;

      } else {
        return "Not-Found";
      }

    }

    return {
        fieldChanged: fieldChanged
    };

});
