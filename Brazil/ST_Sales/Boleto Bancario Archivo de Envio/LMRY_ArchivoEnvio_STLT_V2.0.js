/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_ArchivoEnvio_STLT_V2.0.js  		              ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 09 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */

/**
 * @param {String} type Context Types: scheduled, ondemand, userinterface, aborted, skipped
 * @returns {Void}
 */
define(['N/ui/serverWidget', 'N/email', 'N/runtime', 'N/file', 'N/log', 'N/task', 'N/url', 'N/search', 'N/redirect', 'N/record', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
  function(ui, email, runtime, file, log, task, url, search, redirect, record, libraryMail) {

    var LMRY_script = 'LatamReady - Archivo Envio STLT';

    function onRequest(context) {

      var paintFieldBank = false;
      var ST_FEATURE = false;

      var language = runtime.getCurrentScript().getParameter({
        name: 'LANGUAGE'
      });
      language = language.substring(0, 2);
      if (language == 'es') {
        var lblform = 'LatamReady - Generación Archivo de Envío de Cobranza';
        var lblsubsidiaria = 'Subsidiaria';
        var lblbanco = 'Banco';
        var lblfrom = 'Desde';
        var lblto = 'Hasta';
        // LAbel para cuando sea una cuenta con SUITETAX
        var lblnexus = 'Nexo'
        var btnprocess = 'Procesar';
        var informationCollectionFile = 'Ver Archivo Envío';
        var alertaFeatures = "AVISO:  Actualmente la licencia para este modulo se encuentra vencida, por favor contactese con el equipo comercial de LatamReady.</br> Tambien puede contactarse con nosotros por medio de www.Latamready.com";
        var lblinline = 'Importante: Al usar NetSuite Transaction, usted asume toda la responsabilidad ';
        lblinline += 'de determinar si los datos que genera y descarga son exactos o suficientes';
        lblinline += 'para sus propósitos. También asume toda la responsabilidad por la ';
        lblinline += 'seguridad de los datos que descargue de NetSuite y posteriormente ';
        lblinline += 'almacene fuera del sistema NetSuite.';
        var subresult = 'Resultados';
        var sublblid = 'ID INTERNO';
        var sublbldate = 'FECHA CREACIÓN';
        var sublblemployee = 'USUARIO';
        var sublbllistProcess = 'ARCHIVO DE ENVÍO DE COBRANZA';
        var sublblstate = 'ESTADO';
        var sublbllast = 'ÚLTIMA MODIFICACIÓN';
        var groupPrimaryInformation = 'Información primaria'
        var groupDateRange = 'Intervalo de fechas';

      } else if (language == 'pt') {
        var lblform = 'LatamReady - Geração de Arquivo de Remessa';
        var lblsubsidiaria = 'Subsidiária';
        var lblbanco = 'Banco'
        var lblfrom = 'A partir de';
        var lblto = 'Até';
        // LAbel para cuando sea una cuenta con SUITETAX
        var lblnexus = 'Nexo'
        var btnprocess = 'Processo';
        var informationCollectionFile = 'Ver Arquivo de Remessa';
        var alertaFeatures = "AVISO: Atualmente, a licença para este módulo expirou, entre em contato com a equipe de vendas da LatamReady. </br> Você também pode entrar em contato conosco através do site www.Latamready.com";
        var lblinline = 'Importante: Ao utilizar NetSuite Transaction, você assume total responsabilidade ';
        lblinline += 'para determinar se os dados que você gera e baixa são precisos ou suficientes ';
        lblinline += 'para os seus propósitos. Você também assume total responsabilidade pela ';
        lblinline += 'segurança dos dados que você baixa da NetSuite e posteriormente ';
        lblinline += 'armazenado fora do sistema NetSuite.';
        var subresult = 'Resultados';
        var sublblid = 'ID INTERNA';
        var sublbldate = 'DATA DE CRIAÇÃO';
        var sublblemployee = 'Usuário';
        var sublbllistProcess = 'Arquivo de Remessa';
        var sublblstate = 'Estado';
        var sublbllast = 'ÚLTIMA MODIFICAÇÃO';
        var groupPrimaryInformation = 'Informação Primária'
        var groupDateRange = 'Intervalo de datas';

      } else {
        var lblform = 'LatamReady - Collection File Generation';
        var lblsubsidiaria = 'Subsidiary';
        var lblbanco = 'Bank';
        var lblfrom = 'From';
        var lblto = 'To'
        // LAbel para cuando sea una cuenta con SUITETAX
        var lblnexus = 'Nexus'
        var btnprocess = 'Process';
        var informationCollectionFile = 'See Collection File';
        var alertaFeatures = "NOTICE: Currently the license for this module has expired, please contact the LatamReady sales team. </br> You can also contact us through www.Latamready.com";
        var lblinline = 'Important: By using the NetSuite Transaction, you assume all responsibility ';
        lblinline += 'determining whether the data you generate and download is accurate or ';
        lblinline += 'sufficient for your purposes. You also assume all responsibility for ';
        lblinline += 'the security of any data that you download from NetSuite and subsequently ';
        lblinline += 'store outside of the NetSuite system.';
        var subresult = 'Results';
        var sublblid = 'INTERNAL ID';
        var sublbldate = 'DATE CREATED';
        var sublblemployee = 'USER';
        var sublbllistProcess = 'COLLECTION FILE';
        var sublblstate = 'STATE';
        var sublbllast = 'LAST MODIFIED';
        var groupPrimaryInformation = 'Primary Information'
        var groupDateRange = 'Date Range';
      }

      try {

        if (context.request.method === 'GET') {

          ST_FEATURE = runtime.isFeatureInEffect({feature: 'tax_overhauling'});

          var arraySub = [];
          var licenses = [];
          var form = ui.createForm({
            title: lblform
          });

          arraySub = obtenerSubsidiarias(0);

          // Verifica si el pais tiene acceso
          if (arraySub.length == 0) {
            var form = ui.createForm({
              title: lblform
            });

            // Mensaje para el cliente
            var myInlineHtml = form.addField({
              id: 'custpage_lmry_v_message',
              label: 'MESSAGE',
              type: ui.FieldType.INLINEHTML
            });

            myInlineHtml.layoutType = ui.FieldLayoutType.OUTSIDEBELOW;
            myInlineHtml.updateBreakType({
              breakType: ui.FieldBreakType.STARTCOL
            });

            var strhtml = "<html>";
            strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>" +
              "<tr>" +
              "</tr>" +
              "<tr>" +
              "<td class='text'>" +
              "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" +
              alertaFeatures +
              "</div>" +
              "</td>" +
              "</tr>" +
              "</table>" +
              "</html>";
            myInlineHtml.defaultValue = strhtml;

            // Dibuja el formularios
            context.response.writePage(form);

            // Termina el SuiteLet
            return true;
          }

          var Rd_SubId = context.request.parameters.subsidiary;
          var Rd_Bank = context.request.parameters.custparam_bank;

          // Grupo del formulario
          form.addFieldGroup({
            id: 'group_pi',
            label: groupPrimaryInformation
          });

          var select_subsidiaria = form.addField({
            id: 'selectfield_subsidiaria_br',
            type: ui.FieldType.SELECT,
            container: 'group_pi',
            label: lblsubsidiaria
          });
          select_subsidiaria.isMandatory = true;

          select_subsidiaria.addSelectOption({
            value: ' ',
            text: ' '
          });

          //Busqueda de Subsidiaria por pais de Brasil, cuenten con localización y algunos de los features bancarios activos
          obtenerSubsidiarias(select_subsidiaria);

          // Seteo en el rellamado
          if (Rd_SubId != '' && Rd_SubId != null) {
            select_subsidiaria.defaultValue = Rd_SubId;
            licenses = libraryMail.getLicenses(Rd_SubId);


            /************************************* MODIFICACIÓN ***********************************************************
                - Fecha: 09/03/2020
                - Descripción: Se añadió un campo Select filtro más para el tipo de Banco
            ***************************************************************************************************************/

            //Si esta activo solo el feature de BAML y los Fetures de ITAU y BB estan desactivados, entonces no se dibuja el campo BANK en el STLT
            if (!(libraryMail.getAuthorization(386, licenses) === true && libraryMail.getAuthorization(447, licenses) == false && libraryMail.getAuthorization(446, licenses) == false && libraryMail.getAuthorization(445, licenses) == false && libraryMail.getAuthorization(530, licenses) == false && libraryMail.getAuthorization(531, licenses) == false)) {

              paintFieldBank = true;
              var json_bancos = {
                1: libraryMail.getAuthorization(386, licenses), //BAML id_record_bank=1
                2: libraryMail.getAuthorization(447, licenses), //ITAU id_record_bank=2
                3: libraryMail.getAuthorization(446, licenses), //BB id_record_bank=3
                4: libraryMail.getAuthorization(445, licenses), //Bradesco id_record_bank=3
                5: libraryMail.getAuthorization(530, licenses), //Santander id_record_bank=3
                6: libraryMail.getAuthorization(531, licenses) //Citibank id_record_bank=3
              };

              // Solo para el caso cuando la cuenta tenga SuiteTax
              if (ST_FEATURE === true || ST_FEATURE === "T") {

                var select_nexus = form.addField({
                  id: 'custpage_subsidiary_nexus',
                  type: ui.FieldType.SELECT,
                  container: 'group_pi',
                  label: lblnexus,
                });

                select_nexus.addSelectOption({
                  value: ' ',
                  text: ' '
                });

                select_nexus.isMandatory = true;

                // Búsqueda de los Nexus asociados con la subsidiaria
                var search_nexus = search.create({
                  type: 'subsidiary',
                  columns: ['nexus'],
                  filters: [
                    ['isinactive', 'is', 'F'],
                    "and",
                    ['internalId', 'anyof', Rd_SubId]
                  ]
                }).run().getRange(0, 1000);

                if (search_nexus != '' && search_nexus != null) {
                  for (var i = 0; i < search_nexus.length; i++) {
                    var id_nexus = search_nexus[i].getValue('nexus');
                    var name_nexus = search_nexus[i].getText('nexus');
                    select_nexus.addSelectOption({
                      value: id_nexus,
                      text: name_nexus
                    });
                  }
                }

              }

              var select_banco = form.addField({
                id: 'custpage_tipo_banco',
                type: ui.FieldType.SELECT,
                container: 'group_pi',
                label: lblbanco
              });

              select_banco.addSelectOption({
                value: ' ',
                text: ' '
              });

              select_banco.isMandatory = true;


              //  Busqueda de Bancos
              var search_banco = search.create({
                type: 'customrecord_lmry_br_pdf_bank',
                columns: ['internalid', 'name'],
                filters: [
                  ['isinactive', 'is', 'F']
                ]
              });
              //isinactive si se pone T trae todos los inactivos y si es F solo trae los activos

              //Se muestra la lista de bancos, solo si estan activos los features del Banco
              var searchResultBanco = search_banco.run().getRange(0, 1000);
              if (searchResultBanco != '' && searchResultBanco != null) {
                for (var i = 0; i < searchResultBanco.length; i++) {
                  var id_bank = searchResultBanco[i].getValue('internalid');
                  if (json_bancos[id_bank]) {
                    var id_bank = searchResultBanco[i].getValue('internalid');
                    var name_bank = searchResultBanco[i].getValue('name');
                    select_banco.addSelectOption({
                      value: id_bank,
                      text: name_bank
                    });
                  }

                }
              }
            }
          }


          // ********************************************FIN MODIFICACIÓN ***********************************************


          // Grupo del formulario
          form.addFieldGroup({
            id: 'group_rg',
            label: groupDateRange
          });

          var fieldFechaDesde = form.addField({
            id: 'field_fecha_desde',
            type: ui.FieldType.DATE,
            container: 'group_rg',
            label: lblfrom
          });
          fieldFechaDesde.isMandatory = true;

          var fieldFechaHasta = form.addField({
            id: 'field_fecha_hasta',
            type: ui.FieldType.DATE,
            container: 'group_rg',
            label: lblto
          });
          fieldFechaHasta.isMandatory = true;

          // Mensaje al usuario
          var myInlineHtml = form.addField({
            id: 'custpage_id_message',
            label: 'MESSAGE',
            type: ui.FieldType.INLINEHTML
          });
          myInlineHtml.layoutType = ui.FieldLayoutType.OUTSIDEBELOW;
          /* myInlineHtml.updateBreakType({
                          breakType: ui.FieldBreakType.STARTCOL
                      });*/

          var strhtml = "<html>";
          strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>";
          strhtml += "<tr>";
          strhtml += "</tr>";
          strhtml += "<tr>";
          strhtml += "<td class='text'>";
          strhtml += "<div style=\"color: gray; font-size: 8pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">";
          strhtml += lblinline;
          strhtml += "</div>";
          strhtml += "</td>";
          strhtml += "</tr>";
          strhtml += "</table>";
          strhtml += "</html>";
          myInlineHtml.defaultValue = strhtml;

          // Crea la sublista Estatica
          var sublist = form.addSublist({
            id: 'custpage_lst',
            type: ui.SublistType.STATICLIST,
            label: subresult
          });

          sublist.addField({
            id: 'custpage_lst_internal_id',
            type: ui.FieldType.TEXT,
            label: sublblid
          });
          sublist.addField({
            id: 'custpage_lst_date_create',
            type: ui.FieldType.TEXT,
            label: sublbldate
          });
          sublist.addField({
            id: 'custpage_lst_user',
            type: ui.FieldType.TEXT,
            label: sublblemployee
          });
          sublist.addField({
            id: 'custpage_lst_subsidiary',
            type: ui.FieldType.TEXT,
            label: lblsubsidiaria
          });

          //******* Modificacion 10/03/20202 *******
          //Si la variable paintFieldBank es igual a true , entonces se dibuja el campo BANK en la sublista
          if (paintFieldBank == true || (Rd_Bank != '' && Rd_Bank != null)) {
            sublist.addField({
              id: 'custpage_lst_bank',
              type: ui.FieldType.TEXT,
              label: lblbanco
            });
          }
          //********* Fin modificación **********
          sublist.addField({
            id: 'custpage_lst_from',
            type: ui.FieldType.TEXT,
            label: lblfrom
          });
          sublist.addField({
            id: 'custpage_lst_to',
            type: ui.FieldType.TEXT,
            label: lblto
          });

          sublist.addField({
            id: 'custpage_lst_archivo_envio',
            type: ui.FieldType.TEXT,
            label: sublbllistProcess
          });

          sublist.addField({
            id: 'custpage_lst_state',
            type: ui.FieldType.TEXT,
            label: sublblstate
          });

          sublist.addField({
            id: 'custpage_lst_las',
            label: sublbllast,
            type: ui.FieldType.TEXT
          });
          sublist.addRefreshButton();

          //Busqueda de los registros del Archivo de Envio
          var searchObj = search.create({
            type: 'customrecord_lmry_br_log_shipping_file',
            columns: [{
                name: 'internalid',
                sort: search.Sort.DESC
              }, {
                name: 'created'
              }, {
                name: 'custrecord_lmry_br_log_user'
              }, {
                name: 'custrecord_lmry_br_log_subsidiary'
              }, {
                name: 'custrecord_lmry_br_log_date_from'
              }, {
                name: 'custrecord_lmry_br_log_date_to'
              }, {
                name: 'custrecord_lmry_br_log_state'
              }, {
                name: 'lastmodified'
              }, {
                name: 'custrecord_lmry_br_log_idfile'
              }, {
                name: "name",
                join: "CUSTRECORD_LMRY_BR_LOG_SUBSIDIARY",
                label: "Name"
              },
              {
                name: "legalname",
                join: "CUSTRECORD_LMRY_BR_LOG_SUBSIDIARY",
                label: "Legal Name"
              }, {
                name: 'name',
                join: "custrecord_lmry_br_log_bank",
                label: "NAME"
              }
            ],
            filters: [
              ['isinactive', 'is', 'F']
            ]
          });
          var searchResult = searchObj.run().getRange(0, 1000);

          if (searchResult != null && searchResult.length != '') {
            for (var i = 0; i < searchResult.length; i++) {

              var columns = searchResult[i].columns;

              var log_id = searchResult[i].getValue(columns[0]);
              if (log_id)
                sublist.setSublistValue({
                  id: 'custpage_lst_internal_id',
                  line: i,
                  value: log_id
                });


              var log_created = searchResult[i].getValue(columns[1]);
              if (log_created)
                sublist.setSublistValue({
                  id: 'custpage_lst_date_create',
                  line: i,
                  value: log_created
                });

              var log_user = searchResult[i].getValue(columns[2]);
              if (log_user)
                sublist.setSublistValue({ id: 'custpage_lst_user', line: i, value: log_user });

              var log_subsi_legalname = searchResult[i].getValue(columns[10]);
              var log_subsi_name = searchResult[i].getValue(columns[9]);

              if (log_subsi_legalname) {
                sublist.setSublistValue({ id: 'custpage_lst_subsidiary', line: i, value: log_subsi_legalname });
              } else {
                if (log_subsi_name) {
                  sublist.setSublistValue({ id: 'custpage_lst_subsidiary', line: i, value: log_subsi_name });
                }

              }
              //************************* Modificacion 10/03/20202 **************************
              //Si la variable paintFieldBank es igual a 1 , entonces se dibuja el campo BANK en la sublista
              if (paintFieldBank == true || (Rd_Bank != '' && Rd_Bank != null)) {
                var log_bank = searchResult[i].getValue(columns[11]);
                if (log_bank)
                  sublist.setSublistValue({
                    id: 'custpage_lst_bank',
                    line: i,
                    value: log_bank
                  });
              }
              //****************************************************************************** */

              var log_date_from = searchResult[i].getValue(columns[4]);
              if (log_date_from)
                sublist.setSublistValue({ id: 'custpage_lst_from', line: i, value: log_date_from });

              var log_date_to = searchResult[i].getValue(columns[5]);
              if (log_date_to)
                sublist.setSublistValue({ id: 'custpage_lst_to', line: i, value: log_date_to });

              var log_state = searchResult[i].getValue(columns[6]);

              var host = url.resolveDomain({
                hostType: url.HostType.APPLICATION
              });

              if (log_state == 'Finalized') {
                var shippingFile_id = searchResult[i].getValue(columns[8]);

                if (shippingFile_id) {
                  var linktext = '';
                  var url_full = '';
                  var url_suiteletDetail = url.resolveScript({
                    scriptId: 'customscript_lmry_br_archivodetalle_stlt',
                    deploymentId: 'customdeploy_lmry_br_archivodetalle_stlt',
                  });
                  url_full = 'https://' + host + url_suiteletDetail + '&custparam_log_id=' + log_id;

                  linktext = '<a href="' + url_full + '">' + informationCollectionFile + '</a>';
                  if (linktext) {
                    sublist.setSublistValue({ id: 'custpage_lst_archivo_envio', line: i, value: linktext });
                  }
                }

              }

              if (log_state)
                sublist.setSublistValue({ id: 'custpage_lst_state', line: i, value: log_state });

              var log_lastModified = searchResult[i].getValue(columns[7]);
              if (log_lastModified)
                sublist.setSublistValue({ id: 'custpage_lst_las', line: i, value: log_lastModified });

            }
          }

          // Boton de envio de formulario
          form.addSubmitButton({
            label: btnprocess
          });
          // form.addResetButton({
          //     label: btnreset
          // });

          //SCRIPT CLIENT
          form.clientScriptModulePath = './Latam_Library/LMRY_ArchivoEnvio_CLNT_V2.0.js';

          // Dibuja el formulario
          context.response.writePage(form);

        } else {
          //POST
          //Busqueda de los record LatamReady - BR Log Shipping File con el estado procesando
          /*  var search_log = search.create({
                type: 'customrecord_lmry_br_log_shipping_file',
                columns: [
                    {
                        name: 'internalid',
                        sort: search.Sort.ASC
                    }],
                filters: [
                    ['custrecord_lmry_br_log_state', 'is', 'Processing']
                ]
            });
            var searchResultlog = search_log.run().getRange(0, 1);

            //Si no hay ningun record con el estado procesando,
            //se procede a crear el registro personalizado LatamReady - BR Log Shipping File
            if (searchResultlog.length == 0) {*/
          var licenses = [];

          ST_FEATURE = runtime.isFeatureInEffect({feature: 'tax_overhauling'});

          var subsi = context.request.parameters.selectfield_subsidiaria_br;
          licenses = libraryMail.getLicenses(subsi);

          if (!(libraryMail.getAuthorization(386, licenses) === true && libraryMail.getAuthorization(447, licenses) == false && libraryMail.getAuthorization(446, licenses) == false && libraryMail.getAuthorization(445, licenses) == false && libraryMail.getAuthorization(530, licenses) == false && libraryMail.getAuthorization(531, licenses) == false)) {
            var Bank = context.request.parameters.custpage_tipo_banco;
          } else {
            var Bank = '1';
          }
          var fecha_desde = context.request.parameters.field_fecha_desde;
          var fecha_hasta = context.request.parameters.field_fecha_hasta;

          // PARA EL CASO DE SuiteTax
          var subsidiary_nexus = "";
          if(ST_FEATURE === true || ST_FEATURE === "T") {
            subsidiary_nexus = context.request.select_nexus;
          }

          //Creando el Record LatamReady - BR Log Shipping File
          var record_log_shipping_file = record.create({
            type: 'customrecord_lmry_br_log_shipping_file',
            isDynamic: true
          });

          record_log_shipping_file.setValue({
            fieldId: 'custrecord_lmry_br_log_subsidiary',
            value: subsi
          });

          record_log_shipping_file.setValue({
            fieldId: 'custrecord_lmry_br_log_bank',
            value: Bank
          });

          record_log_shipping_file.setText({
            fieldId: 'custrecord_lmry_br_log_date_from',
            text: fecha_desde
          });

          record_log_shipping_file.setText({
            fieldId: 'custrecord_lmry_br_log_date_to',
            text: fecha_hasta
          });

          record_log_shipping_file.setValue({
            fieldId: 'custrecord_lmry_br_log_user',
            value: runtime.getCurrentUser().name
          });

          record_log_shipping_file.setValue({
            fieldId: 'custrecord_lmry_br_log_state',
            value: 'Processing'
          });

          var id_log = record_log_shipping_file.save();

          redireccionarMPRDSegunBanco(Bank, id_log, subsidiary_nexus);

          redirect.toSuitelet({
            scriptId: runtime.getCurrentScript().id,
            deploymentId: runtime.getCurrentScript().deploymentId,
            parameters: {
              'custparam_bank': context.request.parameters.custpage_tipo_banco,
            }
          });

        }

      } catch (err) {
        libraryMail.sendemail(' [ onRequest ] ' + err, LMRY_script);
      }

    }

    function redireccionarMPRDSegunBanco(id_banco, id_log, subsidiary_nexus) {
      try {
        switch (id_banco) {
          case '1':

            var script_MPRD_BAML = task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: 'customscript_lmry_br_archivoenvio_mprd',
              deploymentId: 'customdeploy_lmry_br_archivoenvio_mprd',
              params: {
                'custscript_lmry_br_record_log_id_mprd': id_log,
                'custscript_lmry_baml_subsidiary_nexus': subsidiary_nexus
              }
            });

            script_MPRD_BAML.submit();
            break;

          case '2':

            var script_MPRD_ITAU = task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: 'customscript_lmry_archivoenvioitau_mprd',
              deploymentId: 'customdeploy_lmry_archivoenvioitau_mprd',
              params: {
                'custscript_lmry_br_recordlogid_itau_mprd': id_log,
                'custscript_lmry_itau_subsidiary_nexus': subsidiary_nexus
              }
            });

            script_MPRD_ITAU.submit();
            break;

          case '3':
            var script_MPRD_BB = task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: 'customscript_lmry_archivoenviobb_mprd',
              deploymentId: 'customdeploy_lmry_archivoenviobb_mprd',
              params: {
                'custscript_lmry_bb_record_log_id_mprd': id_log,
                'custscript_lmry_bb_subsidiary_nexus': subsidiary_nexus
              }
            });

            script_MPRD_BB.submit();
            break;

          case '4':
            var script_MPRD_Bradesco = task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: 'customscript_lmry_archivoenviobrd_mprd',
              deploymentId: 'customdeploy_lmry_archivoenviobrd_mprd',
              params: {
                'custscript_lmry_brd_record_log': id_log,
                'custscript_lmry_brd_subsidiary_nexus': subsidiary_nexus
              }
            });

            script_MPRD_Bradesco.submit();
            break;

          case '5':
            var script_Santander_BB = task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: 'customscript_lmry_archivoenviostd_mprd',
              deploymentId: 'customdeploy_lmry_archivoenviostd_mprd',
              params: {
                'custscript_lmry_br_recordlogid_std_mprd': id_log,
                'custscript_lmry_std_subsidiary_nexus': subsidiary_nexus
              }
            });

            script_Santander_BB.submit();
            break;

          case '6':
            var script_MPRD_Citibank = task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: 'customscript_lmry_archivoenviociti_mprd',
              deploymentId: 'customdeploy_lmry_archivoenviociti_mprd',
              params: {
                'custscript_lmry_br_recordlogid_citi_mprd': id_log,
                'custscript_lmry_cb_subsidiary_nexus': subsidiary_nexus
              }
            });

            script_MPRD_Citibank.submit();
            break;
        }


      } catch (err) {
        libraryMail.sendemail(' [ redireccionarSegunBanco ] ' + err, LMRY_script);
      }

    }

    function obtenerSubsidiarias(subsidiaria) {
      var arraySub = [];
      var allLicenses = libraryMail.getAllLicenses();

      var Filter_Custo = new Array();
      Filter_Custo[0] = search.createFilter({
        name: 'isinactive',
        operator: search.Operator.IS,
        values: 'F'
      });
      Filter_Custo[1] = search.createFilter({
        name: 'country',
        operator: search.Operator.ANYOF,
        values: 'BR'
      });

      var search_Subs = search.create({
        type: search.Type.SUBSIDIARY,
        filters: Filter_Custo,
        columns: ['internalid', 'name']
      });
      var resul_sub = search_Subs.run();
      var lengt_sub = resul_sub.getRange({
        start: 0,
        end: 1000
      });

      if (lengt_sub != null && lengt_sub.length > 0) {

        // Llenado de listbox
        for (var i = 0; i < lengt_sub.length; i++) {
          var subID = lengt_sub[i].getValue('internalid');
          var subNM = lengt_sub[i].getValue('name');

          if (allLicenses[subID] != null && allLicenses[subID] != undefined) {


            if (allLicenses[subID].indexOf(140) > -1 && (allLicenses[subID].indexOf(386) > -1 || allLicenses[subID].indexOf(446) > -1 || allLicenses[subID].indexOf(447) > -1 || allLicenses[subID].indexOf(445) > -1 || allLicenses[subID].indexOf(530) > -1 || allLicenses[subID].indexOf(531) > -1)) {
              arraySub.push(subID);
              if (subsidiaria != 0) {
                subsidiaria.addSelectOption({
                  value: subID,
                  text: subNM
                });
              }
            }
          }
        }
        return arraySub;
      }
    }

    return {
      onRequest: onRequest
    };
  });
