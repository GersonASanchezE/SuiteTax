/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_TaxResult_Engine_STLT_V2.1.js               ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.1     Feb 02 2022  LatamReady    Bundle 37714             ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */


define([
    'N/log',
    'N/ui/serverWidget',
    'N/runtime',
    'N/redirect',
    'N/url',
    'N/task',
    './Latam_Library/LMRY_TaxResult_Engine_LBRY_V2.1',
    './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0',
    './Latam_Library/LMRY_Log_LBRY_V2.0.js'
], (log, serverWidget, runtime, redirect, url, task, Library_Engine, Library_Mail, Library_Log) => {

    // Script information
    const LMRY_SCRIPT = "LatamReaady - Tax Result Engine STLT V2.1";
    const LMRY_SCRIPT_NAME = "LMRY_TaxResult_Engine_STLT_V2.1.js ";

    // Features
    let FEATURE_SUBSIDIARY = false;

    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} scriptContext
     * @param {ServerRequest} scriptContext.request - Encapsulation of the incoming request
     * @param {ServerResponse} scriptContext.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    const onRequest = (scriptContext) => {

        try {

            let state = false;
            let Language = runtime.getCurrentScript().getParameter({ name: "LANGUAGE" }).substring(0, 2);
            let labelFields = _getLabelFields(Language);

            FEATURE_SUBSIDIARY = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

            if (scriptContext.request.method == "GET") {

                // Variables para el rellamado
                let RD_Subsidiary = scriptContext.request.parameters.custparam_lmry_subsidiary;
                let RD_Country = scriptContext.request.parameters.custparam_lmry_country;
                let RD_DateFrom = scriptContext.request.parameters.custparam_lmry_date_from;
                let RD_DateTo = scriptContext.request.parameters.custparam_lmry_date_to;
                log.debug('[ RD_Subsidiary, RD_Country, RD_DateFrom, RD_DateTo ]', [RD_Subsidiary, RD_Country, RD_DateFrom, RD_DateTo]);

                let allSubsidiaries = Library_Engine.getAllSubsidiaries();
                let allLicenses = Library_Mail.getAllLicenses();

                let licenses = [];
                let activeSubsidiary = false;
                for (let i = 0; i < allSubsidiaries.length; i++) {

                    if (allLicenses[allSubsidiaries[i].value] != null && allLicenses[allSubsidiaries[i].value] != "") {
                        licenses = allLicenses[allSubsidiaries[i].value];
                    } else {
                        licenses = [];
                    }

                    if (Library_Mail.getAuthorization(760, licenses) == true) {
                        allSubsidiaries[i].active = true;
                        activeSubsidiary = true;
                    }

                }

                let form = serverWidget.createForm({ title: labelFields.lbl_FormTitle });

                if (!activeSubsidiary) {

                    let myInlineHtml = form.addField({
                        id: "custpage_lmry_warning_message",
                        label: labelFields.lbl_WarningMessage,
                        type: serverWidget.FieldType.INLINEHTML
                    });

                    myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
                    myInlineHtml.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTCOL });

                    var inline_html = `
                        <html>
                            <table border='0' class='table_fields' cellspacing='0' cellpadding='0'>
                                <tr></tr>
                                <tr>
                                    <td class='text'>
                                        <div style='color:gray; font-size:12pt; margin-top:10px; padding:5px; border-top:1pt solid silver;'>
                                            ${labelFields.lbl_Message1}. </br> ${labelFields.lbl_Message2}: www.latamready.com
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </html>
                    `;

                    myInlineHtml.defaultValue = inline_html;
                    scriptContext.response.writePage(form);

                    return true

                }

                form.addFieldGroup({
                    id: "group_information",
                    label: labelFields.lbl_InformationGroup
                });

                let subsidiaryField = "";
                if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {

                    subsidiaryField = form.addField({
                        id: "custpage_lmry_subsidiary",
                        label: labelFields.lbl_Subsidiary,
                        type: serverWidget.FieldType.SELECT,
                        container:  "group_information"
                    });

                    subsidiaryField.addSelectOption({ text: "", value: 0 });
                    for (let i = 0; i < allSubsidiaries.length; i++) {
                        if (allSubsidiaries[i].active == true) {
                            subsidiaryField.addSelectOption({
                                text: allSubsidiaries[i].text,
                                value: allSubsidiaries[i].value
                            });
                        }
                    }

                    subsidiaryField.isMandatory = true;

                }

                // Autopopulado del rellamado
                if (RD_Subsidiary != null && RD_Subsidiary != "") {
                    subsidiaryField.defaultValue = RD_Subsidiary;
                    subsidiaryField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                }

                let countryField = form.addField({
                    id: "custpage_lmry_country",
                    label: labelFields.lbl_Country,
                    type: serverWidget.FieldType.TEXT,
                    container: "group_information"
                });
                countryField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

                // Autopopulado del rellamado
                if (RD_Country != null && RD_Country != "") {
                    countryField.defaultValue = RD_Country;
                }

                let stateField = form.addField({
                    id: "custpage_lmry_state",
                    label: labelFields.lbl_State,
                    type: serverWidget.FieldType.CHECKBOX,
                    container: "group_information"
                });
                stateField.defaultValue = "F";
                stateField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                // Autopopulado del rellamado
                if (RD_Subsidiary != null && RD_Subsidiary != "") {
                    stateField.defaultValue = "T";
                    state = true;
                }

                form.addFieldGroup({
                    id: "group_dates",
                    label: labelFields.lbl_DateGroup
                });

                let dateFromField = form.addField({
                    id: "custpage_lmry_date_from",
                    label: labelFields.lbl_DateFrom,
                    type: serverWidget.FieldType.DATE,
                    container: "group_dates"
                });

                // Autopopulado del rellamado
                if (RD_DateFrom != null && RD_DateFrom != "") {
                    dateFromField.defaultValue = RD_DateFrom;
                    dateFromField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                }

                let dateToField = form.addField({
                    id: "custpage_lmry_date_to",
                    label: labelFields.lbl_DateTo,
                    type: serverWidget.FieldType.DATE,
                    container: "group_dates"
                });

                // Autopopulado del rellamado
                if (RD_DateTo != null && RD_DateTo != "") {
                    dateToField.defaultValue = RD_DateTo;
                    dateToField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                }

                // Creando Sublista
                let jsonSubList = form.addSublist({
                    id: "custpage_lmry_json_sublist",
                    type: serverWidget.SublistType.LIST,
                    label: labelFields.lbl_SubList
                });

                jsonSubList.addMarkAllButtons();
                jsonSubList.addField({ id: "col_lmry_apply", label: labelFields.lbl_Apply, type: serverWidget.FieldType.CHECKBOX });
                jsonSubList.addField({ id: "col_lmry_order", label: labelFields.lbl_Order, type: serverWidget.FieldType.TEXT });
                jsonSubList.addField({ id: "col_lmry_json_id", label: labelFields.lbl_InternalID, type: serverWidget.FieldType.TEXT });
                jsonSubList.addField({ id: "col_lmry_transaction", label: labelFields.lbl_Transaction, type: serverWidget.FieldType.TEXT });
                jsonSubList.addField({ id: "col_lmry_transaction_type", label: labelFields.lbl_TransactionType, type: serverWidget.FieldType.TEXT });
                jsonSubList.addField({ id: "col_lmry_posting_period", label: labelFields.lbl_Period, type: serverWidget.FieldType.TEXT });
                jsonSubList.addField({ id: "col_lmry_entity", label: labelFields.lbl_Entity, type: serverWidget.FieldType.TEXT });

                if ((RD_Subsidiary != null && RD_Subsidiary != "") && (RD_Country != null && RD_Country != "") &&
                    (RD_DateFrom != null && RD_DateFrom != "") && (RD_DateTo != null && RD_DateTo != "")) {

                    let jsonResult = Library_Engine.getJsonResult(RD_Subsidiary, RD_DateFrom, RD_DateTo);
                    log.debug('[ jsonResult ]', jsonResult);
                    if (jsonResult != null && jsonResult.length > 0) {
                        for(let i = 0; i < jsonResult.length; i++) {

                            let url_internalID = url.resolveRecord({
                                recordType: "customrecord_lmry_ste_json_result",
                                recordId: parseInt(jsonResult[i].internalid)
                            });
                            jsonSubList.setSublistValue({
                                id: "col_lmry_json_id",
                                line: i,
                                value: `<a href="${url_internalID}" target="_blank">${jsonResult[i].internalid}</a>`
                            });


                            jsonSubList.setSublistValue({ id: "col_lmry_order", line: i, value: Number(i + 1) })
                            jsonSubList.setSublistValue({ id: "col_lmry_transaction", line: i, value: jsonResult[i].transaction.value });
                            jsonSubList.setSublistValue({ id: "col_lmry_transaction_type", line: i, value: jsonResult[i].transaction_type.text });
                            jsonSubList.setSublistValue({ id: "col_lmry_posting_period", line: i, value: jsonResult[i].transaction_period.text });
                            jsonSubList.setSublistValue({ id: "col_lmry_entity", line: i, value: jsonResult[i].transaction_entity.text });

                        }
                    }

                }

                if (state == false || state == "F") {
                    form.addSubmitButton({ label: "Filter" });
                } else {
                    form.addSubmitButton({ label: "Generate" });
                }

                // Script Cliente
                form.clientScriptModulePath = './LMRY_TaxResult_Engine_CLNT_V2.1.js';

                scriptContext.response.writePage(form);

            } else {

                state = scriptContext.request.parameters.custpage_lmry_state;
                if (state == false || state == "F") {

                    let params = {};
                    if (FEATURE_SUBSIDIARY == true || FEATURE_SUBSIDIARY == "T") {
                        params.custparam_lmry_subsidiary = scriptContext.request.parameters.custpage_lmry_subsidiary;
                    }
                    params.custparam_lmry_country = scriptContext.request.parameters.custpage_lmry_country;
                    params.custparam_lmry_date_from = scriptContext.request.parameters.custpage_lmry_date_from;
                    params.custparam_lmry_date_to = scriptContext.request.parameters.custpage_lmry_date_to;

                    redirect.toSuitelet({
                        scriptId: runtime.getCurrentScript().id,
                        deploymentId: runtime.getCurrentScript().deploymentId,
                        parameters: params
                    });

                }

            }

        } catch (e) {
            log.error('[ onRequest ]', e);
            Library_Mail.sendemail('[ onRequest ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ onRequest ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    // Additional functios

    /***************************************************************************
     *
     ***************************************************************************/
    const _getLabelFields = (Language) => {

        try {

            let labelFields = {};

            switch (Language) {
                case "es":
                    labelFields.lbl_FormTitle = "LatamReady - Generador Masivo de Tax Result";
                    labelFields.lbl_WarningMessage = "Mensaje";
                    labelFields.lbl_Message1 = "AVISO: Actualmente la licencia para este módulo está vencida, por favor contacte al equipo comercial de LatamReady";
                    labelFields.lbl_Message2 = "También puede contactarse con nosotros a través de";
                    labelFields.lbl_InformationGroup = "Información Primaria";
                    labelFields.lbl_Subsidiary = "Latam - Subsidiaria";
                    labelFields.lbl_Country = "Latam - País";
                    labelFields.lbl_DateGroup = "Fechas";
                    labelFields.lbl_DateFrom = "Latam - Fecha Desde";
                    labelFields.lbl_DateTo = "Latam - Fecha Hasta";
                    labelFields.lbl_State = "Latam - Estado";
                    labelFields.lbl_SubList = "Resultados";
                    labelFields.lbl_Apply = "Aplicar";
                    labelFields.lbl_InternalID = "ID Interno";
                    labelFields.lbl_Transaction = "Transacción";
                    labelFields.lbl_TransactionType = "Tipo de Transacción";
                    labelFields.lbl_Period = "Periodo Contable";
                    labelFields.lbl_Entity = "Entidad";
                    labelFields.lbl_Order = "Orden";
                    break;

                case "pt":
                    labelFields.lbl_FormTitle = "LatamReady - Gerador de massa de Tax Result";
                    labelFields.lbl_WarningMessage = "Mensagem";
                    labelFields.lbl_Message1 = "AVISO: Atualmente a licença deste módulo está vencida, entre em contato com a equipe de vendas da LatamReady";
                    labelFields.lbl_Message2 = "Você também pode entrar em contato conosco através";
                    labelFields.lbl_InformationGroup = "Informações primárias";
                    labelFields.lbl_Subsidiary = "Latam - Subsidiária";
                    labelFields.lbl_Country = "Latam - País";
                    labelFields.lbl_DateGroup = "Datas";
                    labelFields.lbl_DateFrom = "Latam - Data De";
                    labelFields.lbl_DateTo = "Latam - Data Para";
                    labelFields.lbl_State = "Latam - Condição";
                    labelFields.lbl_SubList = "Resultados";
                    labelFields.lbl_Apply = "Aplicar";
                    labelFields.lbl_InternalID = "ID Interno";
                    labelFields.lbl_Transaction = "Transação";
                    labelFields.lbl_TransactionType = "Tipo de Transação";
                    labelFields.lbl_Period = "Período Contábil.";
                    labelFields.lbl_Entity = "Entidade";
                    labelFields.lbl_Order = "Ordem";
                    break;

                default:
                    labelFields.lbl_FormTitle = "LatamReady - Tax Result Massive Generator";
                    labelFields.lbl_WarningMessage = "Message";
                    labelFields.lbl_Message1 = "NOTICE: Currently the license for this module is expired, please contact the commercial team of LatamReady";
                    labelFields.lbl_Message2 = "You can also contact us through";
                    labelFields.lbl_InformationGroup = "Primary Information";
                    labelFields.lbl_Subsidiary = "Latam - Subsidiary";
                    labelFields.lbl_Country = "Latam - Country";
                    labelFields.lbl_DateGroup = "Dates";
                    labelFields.lbl_DateFrom = "Latam - Date From";
                    labelFields.lbl_DateTo = "Latam - Date To";
                    labelFields.lbl_State = "Latam - State";
                    labelFields.lbl_SubList = "Results";
                    labelFields.lbl_Apply = "Apply";
                    labelFields.lbl_InternalID = "Internal ID";
                    labelFields.lbl_Transaction = "Transaction";
                    labelFields.lbl_TransactionType = "Transaction Type";
                    labelFields.lbl_Period = "Posting Period";
                    labelFields.lbl_Entity = "Entity";
                    labelFields.lbl_Order = "Order";
            }

            return labelFields;

        } catch (e) {
            log.error('[ _getLabelFields ]', e);
            Library_Mail.sendemail('[ _getLabelFields ]: ' + e, LMRY_SCRIPT);
            Library_Log.doLog({ title: '[ _getLabelFields ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
        }

    }

    return {
      onRequest: onRequest
    };

});
