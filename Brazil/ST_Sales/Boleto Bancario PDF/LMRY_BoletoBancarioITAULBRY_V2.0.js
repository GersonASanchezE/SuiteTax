/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BoletoBancarioITAULBRY_V2.0.js              ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Mar 06 2020  LatamReady    Use Script 2.0           ||
\= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */


define(['N/runtime', 'N/record', 'N/file', 'N/record', 'N/render', 'N/url', 'N/log', 'N/xml', 'N/https', 'N/search', 'N/format', 'N/format/i18n', 'N/config', './LMRY_libSendingEmailsLBRY_V2.0'],
  function(runtime, record, file, record, render, url, log, xml, https, search, format, format2, config, libraryMail) {

    var LMRY_script = 'LMRY_BoletoBancarioITAULBRY_V2.0.js';
    var ST_FEATURE = false;

    //Datos de la Subsidiaria/Beneficiario
    var nomSubsidiaria = '';
    var cnpjSubsidiaria = '';
    var addressSubsidiaria = '';

    //Datos del Customer/Pagador
    var nomCustomer = '';
    var cnpjCustomer = '';
    var addressCustomer = '';

    //Datos del Invoice
    var dateInvoice = ''; //Data do documento , Data Processamento
    var dueDateInvoice = ''; //Vencimento
    var dataVencimiento = '';
    var numPreImpreso = ''; //Núm. do documento
    var montoTotalInvoiceValue = '';
    var montoTotalInvoiceText = ''; //Valor do Documento

    //Datos config: Subsidiaria - Banco ITAU
    var lugarPago = '';
    var agencia = '';
    var agenciaCodBeneficiario = '';
    var codigoBeneficiario = '';
    var aceptacion = ''; //Aceite
    var cartera = ''; //Carteira
    var codigoBanco = '';
    var digitoVerificadorBanco = '';
    var id_logoITAU = '';
    var especieDoc = '';

    //Datos LatamReady - BR Config Currency
    var especieMoneda = '';
    var codigoMoneda = '';

    //Datos para el Boleto Bancario
    var nombreBanco = "Banco Itaú S.A.";
    var instructions = '';
    var nossoNum = '';
    var url_logo = '';
    var anulado = '';
    var codOcurencia = '';


    //Datos para el Codigo de Barras
    var dacPosicion31 = '';
    var codigoBarras = '';
    var lineaDigital = '';

    /* Variable para el campo personalizado que puede contener:
    ID de campos de tipo custbody,Texto libre y salto de linea(enter)*/
    var custom_field = '';

    var licenses = [];
    var id_folder_br_ei = '';
    var host = '';
    var boletos = [];
    var flag = false;

    //Url de web service acortador de link
    const WS_URL = 'https://tstdrv1930452.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=692&deploy=1&compid=TSTDRV1930452&h=42860c3b2ce293fa7084';


    function obtenerURLPdfBoletoBancarioITAU(id_invoice, id_recordConfigBankTicket, statusCodOcurencia, installment, type) {

      try {

        codOcurencia = statusCodOcurencia;
        var Language = runtime.getCurrentScript().getParameter({
          name: 'LANGUAGE'
        });
        Language = Language.substring(0, 2);

        switch (Language) {
          case 'pt':
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:150px;color:alpha(8%,#ff0000)">PEDIDO DE BAIXA</p>';
            break;
          case 'es':
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:140px;color:alpha(8%,#ff0000)">SOLICITUD DE BAJA</p>';
            break;
          default:
            anulado = '<p valign="middle" align="center" rotate="-60" style="font-size:130px;color:alpha(8%,#ff0000)">WRITE OFF REQUEST</p>';
        }

        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: id_invoice,
          columns: ['subsidiary', 'entity', 'trandate', 'duedate', 'custbody_lmry_num_preimpreso', 'fxamount', 'custbody_lmry_wtax_code_des', 'custbody_lmry_wtax_amount', 'currency']
        });

        var subsidiary = recordInvoice.subsidiary[0].value;
        var customer = recordInvoice.entity[0].value;

        dateInvoice = recordInvoice.trandate
        dateInvoice = formatoFecha(dateInvoice);

        dataVencimiento = recordInvoice.duedate;
        if (dataVencimiento) {
          dueDateInvoice = formatoFecha(dataVencimiento);
        }

        numPreImpreso = recordInvoice.custbody_lmry_num_preimpreso;

        var moneda = recordInvoice.currency[0].value;

        montoTotalInvoiceValue = recordInvoice.fxamount;

        //Parseando el montoTotalInvoiceValue a float
        var numberMonto = format.parse({
          value: montoTotalInvoiceValue,
          type: format.Type.FLOAT
        });

        var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
        montoTotalInvoiceText = numFormatter1.format({
          number: numberMonto
        });

        licenses = libraryMail.getLicenses(subsidiary);

        /******************************************************************+******************************************
                - Descripción: Si esta activo el Feature  BR - LATAM WHT TAX y el campo tax_code_des tiene la descripción
                  Latam - WHT Tax , Se resta el monto del invoice con el monto de la retencion (ID:custbody_lmry_wtax_amount)
        ***************************************************************************************************************/
        var tax_code_des = recordInvoice.custbody_lmry_wtax_code_des;

        if (libraryMail.getAuthorization(416, licenses) == true && tax_code_des == 'Latam - WHT Tax') {
          flag = true;
          var retencion = recordInvoice.custbody_lmry_wtax_amount;

          montoTotalInvoiceValue = montoTotalInvoiceValue - retencion;

          var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
          montoTotalInvoiceText = numFormatter1.format({
            number: montoTotalInvoiceValue
          });

          montoTotalInvoiceValue = montoTotalInvoiceValue.toFixed(2);

        }
        // ****************************************************************************************************************

        obtenerDatosSubsidiaria(subsidiary, id_invoice);
        obtenerDatosCustomer(customer, id_invoice);
        obtenerDatosConfigSubsidiariaBancoITAU(id_recordConfigBankTicket, moneda);
        obtenerEspecieDOC(id_invoice);
        instructions = formandoInstrucciones(id_invoice);

        //Nombre del Dominio del Ambiente
        host = url.resolveDomain({
          hostType: url.HostType.APPLICATION
        });

        //************** INICIO - Formando El URL del Logo de ITAU ***********
        if (id_logoITAU != '' && id_logoITAU != null) {
          url_logo = 'https://' + host + file.load(id_logoITAU).url;
        } else {
          url_logo = 'https://tstdrv1038906.app.netsuite.com/core/media/media.nl?id=1048670&c=TSTDRV1038906&h=6f463464875cd1ee4488&fcts=20200226075936&whence=';
        }
        //************** FIN - Formando El URL del Logo de ITAU **************

        //Crea la carpeta "Latam BR - PDF Boleto Bancario" si no existe, en dicha carpeta se guardaran los Boletos Bancarios
        search_folder();

        boletos = formarInstallments(id_invoice, installment, type);

        return boletos;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerURLPdfBoletoBancarioITAU ] ' + err, LMRY_script);

      }
    }

    //osea en vez de id de la subsidiaria (id_subsidiaria) tendria que ser el id del record subsidiaria - banco
    function obtenerDatosConfigSubsidiariaBancoITAU(id_config_bank_ticket, currency) {
      try {
        //busqueda del record customrecord_lmry_br_config_bank_ticket para la config: Subsiiaria - ITAU
        var searchConfigSubsiBank = search.create({
          type: 'customrecord_lmry_br_config_bank_ticket',
          columns: [{
            name: 'custrecord_lmry_beneficiary_code'
          }, {
            name: 'custrecord_lmry_code_bank'
          }, {
            name: 'custrecord_lmry_bank_agency'
          }, {
            name: 'custrecord_lmry_bank_place_of_payment'
          }, {
            name: 'custrecord_lmry_bank_code_cartera'
          }, {
            name: 'custrecord_lmry_bank_accept_bank_ticket'
          }, {
            name: 'custrecord_lmry_bank_check_digit'
          }, {
            name: 'custrecord_lmry_br_docu_specie_siglas',
            join: 'CUSTRECORD_LMRY_BANK_ESPECIE_DOC',
            label: "BR Siglas"
          }, {
            name: 'internalid'
          }, {
            name: 'custrecord_lmry_id_field'
          }, {
            name: 'custrecord_lmry_bank_logo'
          }],
          filters: ['internalid', 'is', id_config_bank_ticket]
        });
        var searchResult = searchConfigSubsiBank.run().getRange(0, 1);

        if (searchResult != '' && searchResult != null) {
          var columns = searchResult[0].columns;

          codigoBeneficiario = searchResult[0].getValue(columns[0]);

          codigoBanco = searchResult[0].getValue(columns[1]);

          agencia = searchResult[0].getValue(columns[2]);
          if (agencia) {
            agenciaCodBeneficiario = agencia + "/" + codigoBeneficiario;
          } else {
            agenciaCodBeneficiario = codigoBeneficiario;
          }

          lugarPago = searchResult[0].getValue(columns[3]);

          cartera = searchResult[0].getValue(columns[4]);

          aceptacion = searchResult[0].getValue(columns[5]);
          if (aceptacion == 1) {
            aceptacion = "A";
          } else {
            aceptacion = "NAO";

          }

          digitoVerificadorBanco = searchResult[0].getValue(columns[6]);

          especieDoc = searchResult[0].getValue(columns[7]);


          //Campo personalizado para la impresión en las instrucciones del PDF, que puede contener: ID de campos de tipo custbody, Texto libre y salto de linea(enter)
          custom_field = searchResult[0].getValue(columns[9]);

          //campo para el Logo de Bank Of America
          id_logoITAU = searchResult[0].getValue(columns[10]);

          var searchConfigCurrency = search.create({
            type: 'customrecord_lmry_br_config_currency',
            columns: [{
              name: 'custrecord_lmry_br_config_currency_name'
            }, {
              name: 'custrecord_lmry_br_config_currency_cod'
            }, {
              name: 'custrecord_lmry_br_config_currency_form'
            }],
            filters: ['custrecord_lmry_br_config_currency_bank', 'is', id_config_bank_ticket]
          });
          var searchResultCurrency = searchConfigCurrency.run().getRange(0, 1000);
          if (searchResultCurrency != '' && searchResultCurrency != null) {
            for (var j = 0; j < searchResultCurrency.length; j++) {

              var name_currency = searchResultCurrency[j].getValue({
                name: 'custrecord_lmry_br_config_currency_name'
              });

              if (name_currency == currency) {
                var code_currency = searchResultCurrency[j].getValue({
                  name: 'custrecord_lmry_br_config_currency_cod'
                });
                var format_currency = searchResultCurrency[j].getValue({
                  name: 'custrecord_lmry_br_config_currency_form'
                });

                codigoMoneda = code_currency;
                especieMoneda = format_currency;

              }
            }

          }
        }
      } catch (err) {
        libraryMail.sendemail(' [ obtenerDatosConfigSubsidiariaBancoITAU ] ' + err, LMRY_script);
      }
    }

    function formarInstallments(id_invoice, installment, type) {
      try {
        var linkBoleto = '';
        var arrayBoletos = [];

        //Se obtiene el Id de la carpeta "Latam BR - PDF Boleto Bancario"
        id_folder_br_ei = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_br_boleto_bancario'});

        if (id_folder_br_ei) {

          linkBoleto = formarPDF(montoTotalInvoiceValue, montoTotalInvoiceText, '', id_invoice);
          arrayBoletos.push(linkBoleto);

          var installments = runtime.isFeatureInEffect({feature: "installments"});

          if (installments && libraryMail.getAuthorization(536, licenses)) {

            var jsonInstallments = [];

            if (installment != '' && installment != null) {
              jsonInstallments = JSON.parse(installment);
            }

            if (Object.keys(jsonInstallments).length) {
              for (var idInstallment in jsonInstallments) {
                var monto = Math.round(parseFloat(jsonInstallments[idInstallment]['amount']) * 100) / 100;

                if(jsonInstallments[idInstallment]['wht'] && flag){
                  var retencion = Math.round(parseFloat(jsonInstallments[idInstallment]['wht']) * 100) / 100;
                  retencion = retencion.toFixed(2);
                  monto = Math.round((parseFloat(monto) - parseFloat(retencion)) * 100) / 100;
                }

                var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
                montoText = numFormatter1.format({
                  number: monto
                });

                monto = monto.toFixed(2);

                if (jsonInstallments[idInstallment]['duedate']) {
                    dataVencimiento = jsonInstallments[idInstallment]['duedate'];
                    dueDateInvoice = formatoFecha(jsonInstallments[idInstallment]['duedate']);
                }

                var link = formarPDF(monto, montoText, idInstallment, id_invoice);
                arrayBoletos.push(link);
              }
            }else {
              var searchInstallments = search.create({
                    type: "invoice",
                    filters:
                        [
                            ["internalid", "anyof", id_invoice], "AND",
                            ["mainline", "is", "T"]
                        ],
                    columns: [
                        search.createColumn({
                            name: "installmentnumber",
                            join: "installment",
                            sort: search.Sort.ASC
                        }),
                        "installment.amount",
                        "installment.duedate"
                    ],
                    settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
                });

              var resultInstallments = searchInstallments.run().getRange(0, 100);

              var row = resultInstallments[0].columns;
              var installNumber = resultInstallments[0].getValue(row[0]);

              if (resultInstallments != null && resultInstallments != '' && installNumber != '' && installNumber!= null) {
                for (var i = 0; i < resultInstallments.length; i++) {
                  var row = resultInstallments[i].columns;
                  var internalId = resultInstallments[i].getValue(row[0]);
                  var monto = resultInstallments[i].getValue(row[1]);
                  var duedate = resultInstallments[i].getValue(row[2]);
                  monto = parseFloat(monto);

                  //Parseando el monto a float
                  var numberMonto = format.parse({
                    value: monto,
                    type: format.Type.FLOAT
                  });

                  var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
                  var montoText = numFormatter1.format({
                    number: numberMonto
                  });

                  monto = monto.toFixed(2);

                  if(duedate){
                    dataVencimiento = duedate;
                    dueDateInvoice = formatoFecha(duedate);
                  }

                  var link = formarPDF(monto, montoText, internalId, id_invoice);
                  arrayBoletos.push(link);

                }
              }
            }
          }

          if(type == '1'){
            record.submitFields({
                type: 'invoice',
                id: id_invoice,
                values: {
                    'custbody_lmry_informacion_adicional': arrayBoletos
                },
                options: {
                    ignoreMandatoryFields: true,
                    enableSourcing: true,
                    disableTriggers: true
                }
            });
          }

          return arrayBoletos;
        }
      } catch (err) {
        libraryMail.sendemail(' [ formarInstallments ] ' + err, LMRY_script);
      }
    }

    function formarPDF(monto, montoText, cod, id_invoice) {
      try {
        var shortLink = '';
        var htmlFinal = '';

        //Formar nossoNúmero
        nossoNum = formandoNossoNumero(id_invoice, cod);
        //Código de barras Del Boleto Bancario
        codigoBarras = obtenerCodigoBarras(monto);
        //Representación númerica del Codigo de Barras
        lineaDigital = obtenerLineaDigital(codigoBarras);

        htmlFinal += reciboPagador(montoText);
        htmlFinal += fichaCompensacion(montoText);

        var xml = "<?xml version=\"1.0\"?><!DOCTYPE pdf PUBLIC \"-//big.faceless.org//report\" \"report-1.1.dtd\">";
        xml += "<pdf> <head> <macrolist><macro id=\"marca\">" + anulado + "</macro></macrolist>";
        if (codOcurencia == 2) {
          xml += "</head><body font-size=\"12\" size=\"A4\" background-macro=\"marca\"><h3></h3>";
        } else {
          xml += "</head><body font-size=\"12\" size=\"A4\"><h3></h3>";
        }
        xml += htmlFinal;
        xml += "</body> </pdf>";

        var myFileObj = render.xmlToPdf({
          xmlString: xml
        });

        //Nombre del Boleto Bancario
        if (cod != '') {
          myFileObj.name = 'BR_BB_ITAU_' + id_invoice + '_' + cod + '.pdf';
        } else {
          myFileObj.name = 'BR_BB_ITAU_' + id_invoice + '.pdf';
        }

        myFileObj.folder = id_folder_br_ei;
        myFileObj.isOnline = true;
        var id_pdf = myFileObj.save();

        var url_archivo_pdf = file.load({
          id: id_pdf
        });
        var urlBoletoBancarioPdf = 'https://' + host + url_archivo_pdf.url;

        //Acortador del link
        var account = runtime.accountId;
        shortLink = libraryMail.acortadorDeLink(WS_URL, urlBoletoBancarioPdf, account);
        return shortLink;

      } catch (err) {
        libraryMail.sendemail(' [ formarPDF ] ' + err, LMRY_script);
      }
    }

    function reciboPagador(monto) {
      var html = "";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center; margin-top:24px;\">";
      html += "<tr>";
      html += "<td style=\"font-size:8pt; padding-bottom:-4px;\" align=\"center\"><b>RECIBO DO PAGADOR </b></td>";
      html += "</tr>";
      html += "</table>";

      html += tablaDeDatos(monto);

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center;\">";
      html += "<tr >";
      html += "<td style=\"font-size:9pt; padding-top:15px; margin-bottom:10px; border-bottom:0.3px dashed;\" align=\"right\" >Autenticação mecânica</td>";
      html += "</tr>";
      html += "</table>";

      return html;

    }

    function tablaDeDatos(monto) {
      var html = "";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:center;padding-bottom:-2.5px\" >";
      html += "<tr>";
      html += "<td style=\"padding-bottom:5px\"  align=\"left\" colspan=\"1\" >   <img src=\"" + xml.escape(url_logo) + "\" width=\"26\" height=\"23\" />  </td>";
      html += "<td valign=\"bottom\"  colspan=\"1\">  <p style=\"font-size:4mm; \"> " + nombreBanco + "</p> </td>";
      html += "<td valign=\"bottom\" width=\"2%\"  colspan=\"1\">  <p style=\"border-left:1px; border-right:1px;  padding-left:12px ;padding-right:12px; padding-top:9px; font-size:4mm\">  <b> " + codigoBanco + "-" + digitoVerificadorBanco + "</b> </p></td>";
      html += "<td valign=\"bottom\" width=\"66%\" align=\"right\" colspan=\"5\"> <p style=\"padding-right:-4px; font-size:4mm; \"> <b>" + lineaDigital + " </b> </p></td>";
      html += "</tr>";
      html += "</table>";

      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; align:center; border:1px; width:183mm;height:95mm; \">";
      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"6\" width=\"138mm\">Local de Pagamento</td>";
      html += "<td style=\"font-size:6.8pt;\" colspan=\"2\" width=\"45mm\">Vencimento</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size:8pt; border-right:1px;\" align=\"left\" colspan=\"6\" >" + reemplazarCaracteresEspeciales(lugarPago) + "</td>";
      html += "<td valign=\"bottom\" style=\"font-size:8pt;\" align=\"center\" colspan=\"2\"> <b>" + dueDateInvoice + " </b> </td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6.8pt;border-right:1px\" colspan=\"6\">Beneficiário</td>";
      html += "<td style=\"font-size:6.8pt;\" colspan=\"2\">Agência / Código do Beneficiário</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size: 8pt; \" align=\"left\" colspan=\"4\">" + nomSubsidiaria + "</td>";
      html += "<td style=\"font-size: 8pt; border-right:1px; padding-left:-20px \" align=\"left\" colspan=\"2\"> <b style=\"font-size:8pt;\">CNPJ/CPF</b> &nbsp;" + cnpjSubsidiaria + "</td>";
      html += "<td style=\"font-size: 8pt;\" align=\"center\" colspan=\"2\">" + agenciaCodBeneficiario + " </td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"6\" >Endereço Beneficiário / Sacador Avalista</td>";
      html += "<td style=\"font-size:6.8pt;\" colspan=\"2\"></td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size:8pt; border-right:1px;\" align=\"left\" colspan=\"6\">" + addressSubsidiaria + "</td>";
      html += "<td style=\"font-size:8pt;\" colspan=\"2\"> </td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"1\"> Data do documento </td>";
      html += "<td style=\"font-size:6.8pt; border-right:1px;\" colspan=\"2\" > Núm. do documento </td>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" coldspan=\"1\"> Espécie Doc. </td>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"1\"> Aceite </td>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"1\"> Data Processamento </td>";
      html += "<td style=\"font-size:6.8pt;\" colspan=\"2\"> Nosso Número </td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\">";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"1\" >" + dateInvoice + " </td>";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"2\" > " + numPreImpreso + " </td>";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"1\" > " + especieDoc + "</td>";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"1\" >" + aceptacion + " </td>";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"1\" > " + dateInvoice + " </td>";
      html += "<td style=\"font-size: 8pt; \" align=\"center\" colspan=\"2\" > " + cartera + "/" + nossoNum + "-" + dacPosicion31 + "</td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"1\">Uso do Banco</td>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"1\">Carteira</td>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"1\">Espécie</td>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"2\">Quantidade</td>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"1\">Valor</td>";
      html += "<td style=\"font-size:6.8pt; \" colspan=\"2\">(=) Valor do Documento</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"1\" >  </td>";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"1\" > " + cartera + " </td>";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"1\" > " + especieMoneda + " </td>";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"2\" >  </td>";
      html += "<td style=\"font-size: 8pt; border-right:1px\" align=\"center\" colspan=\"1\" >  </td>";
      html += "<td style=\"font-size: 8pt;\" align=\"center\" colspan=\"2\" >" + monto + "</td>";
      html += "</tr>";

      html += "<tr>";
      html += "<td style=\"font-size:6.8pt; border-right:1px\" colspan=\"6\" rowspan=\"6\"> <p> Instruções de responsabilidade do BENEFICIÁRIO. Qualquer dúvida sobre este boleto contate o BENEFICIÁRIO. </p> <p style=\"font-size:9pt; \"> " + instructions + "</p>  </td>";
      html += "<td style=\"font-size:6.8pt; \" colspan=\"2\" height=\"50%\">(-) Descontos/Abatimento</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 8pt; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" > </td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size:6.8pt; \" colspan=\"2\">(+) Juros/Multa</td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size: 8pt; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "</tr>";
      html += "<tr >";
      html += "<td style=\"font-size:6.8pt; \" colspan=\"2\">(=) Valor Cobrado</td>";
      html += "</tr>";
      html += "<tr style=\"border-bottom:1px;\" >";
      html += "<td style=\"font-size: 8pt; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
      html += "</tr>";

      html += "<tr >";
      html += "<td style=\"font-size:8pt;\" colspan=\"4\"> <b style=\"font-size:8pt;\"> Pagador -</b> " + nomCustomer + " </td>";
      html += "<td style=\"font-size:8pt;padding-left:4%;\" colspan=\"4\"> <b style=\"font-size:8pt;\"> CNPJ/CPF </b>" + cnpjCustomer + "</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td style=\"font-size: 8pt;\" align=\"left\" colspan=\"8\" >" + addressCustomer + "</td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td colspan=\"4\"> <b style=\"font-size:8pt;\">Sacador/Avalista </b> </td>";
      html += "<td colspan=\"4\"> <b style=\"font-size:8pt;padding-left:24px;\">CNPJ/CPF</b> </td>";
      html += "</tr>";
      html += "</table>";

      return html;

    }

    function fichaCompensacion(monto) {
      var html = "";
      html += tablaDeDatos(monto);

      //codigo de barras
      html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; \">";
      html += "<tr>";
      html += "<td style=\"padding-left:-11px\" rowspan=\"2\" colspan=\"6\" align=\"left\" > <barcode codetype=\"code128\" showtext=\"false\" value=\"" + codigoBarras + "\"  height=\"13mm\" width=\"115mm\"/> </td>";
      html += "<td style=\"padding-left:44px\" colspan=\"2\" > <b style=\"font-size:12pt;\">Ficha de Compensação </b> </td>";
      html += "</tr>";
      html += "<tr>";
      html += "<td valign=\"top\" style=\"font-size:9pt;padding-top:-15px;padding-left:66px\" colspan=\"2\" > Autenticação mecânica </td>";
      html += "</tr>";
      html += "</table>";

      return html;
    }

    function obtenerDatosSubsidiaria(id_subsidiaria, id_invoice) {
      if (id_subsidiaria != 0 && id_invoice != 0) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var subsidiaria = record.load({
          type: record.Type.SUBSIDIARY,
          id: id_subsidiaria,
          isDynamic: true
        });

        /**
         * Para SuiteTax
         */
        if(ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: id_invoice,
            isDynamic: true
          });
          var transaction_nexys = transObj.getValue({fieldId: 'nexus'});
          var taxregnum_lines_subsidiaries = subsidiaria.getLineCount({ sublistId: 'taxregistration' });
          for(var x = 0; x < taxregnum_lines_subsidiaries; x++) {
            var subsidiary_nexus = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'nexus', line: x });
            if(transaction_nexys === subsidiary_nexus){
              var subsidiary_cnpj = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'taxregistrationnumber', line: x });
              break;
            }
          }
        }

        //NOMBRE DE LA SUBSIDIARIA
        var nom_subsidiaria = subsidiaria.getValue({
          fieldId: 'legalname'
        });
        if (nom_subsidiaria) {
          nomSubsidiaria = nom_subsidiaria.substring(0, 30);
          nomSubsidiaria = reemplazarCaracteresEspeciales(nomSubsidiaria);
        }

        //CNPJ DE LA SUBSIDIARIA
        var cnpj_subsidiaria = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_subsidiaria = subsidiaria.getValue({ fieldId: 'federalidnumber' });
        } else {
          cnpj_subsidiaria = subsidiary_cnpj;
        }
        if (cnpj_subsidiaria)
          cnpjSubsidiaria = reemplazarCaracteresEspeciales(cnpj_subsidiaria);

        //DIRECCIÓN DE LA SUBSIDIARIA
        var address_subsidiaria = subsidiaria.getValue(
          'mainaddress_text'
        );
        if (address_subsidiaria)
          addressSubsidiaria = reemplazarCaracteresEspeciales(address_subsidiaria);
      }
      return true;
    }

    function obtenerDatosCustomer(id_customer, internalId) {
      if (id_customer != 0) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var customer_columns = ['isperson', 'firstname', 'lastname', 'companyname'];

        /**
         * Para SuiteTax
         */
        if (ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: internalId,
            isDynamic: true
          });
          var customer_cnpj = transObj.getText({ fieldId: 'entitytaxregnum' });
        } else {
          customer_columns.push("vatregnumber");
        }

        var recordCustomer = search.lookupFields({
          type: search.Type.CUSTOMER,
          id: id_customer,
          columns: customer_columns
        });

        var nom_customer = '';
        var typeCustomer = recordCustomer.isperson;
        //Si el Customer es persona natural typeCustomer es true
        if (typeCustomer == 'T' || typeCustomer == true) {
          var firtsName = recordCustomer.firstname
          var lastName = recordCustomer.lastname;

          nom_customer = firtsName + ' ' + lastName;

        } else {
          nom_customer = recordCustomer.companyname;
        }

        // NOMBRE DEL CLIENTE
        if (nom_customer) {
          nomCustomer = nom_customer.substring(0, 30);
          nomCustomer = reemplazarCaracteresEspeciales(nomCustomer);
        }

        //CNPJ DEL CLIENTE
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_customer = recordCustomer.vatregnumber;
        } else {
          cnpj_customer = customer_cnpj;
        }
        if (cnpj_customer)
          cnpjCustomer = reemplazarCaracteresEspeciales(cnpj_customer);


        // DIRECCIÓN DEL CLIENTE
        //ADDRESS 1
        var billAdress1 = '';
        //LATAM - ADDRESS NUMBER
        var billAdress2 = '';
        //LATAM - ADDRESS REFERENCE
        var billAdress3 = '';
        //ADDRESS 2
        var billAdress4 = '';
        //LATAM - CITY
        var billAdress5 = '';
        //LATAM - PROVINCE ACRONYM
        var billAdress6 = '';
        // ZIP
        var billAdress7 = '';
        // COUNTRY
        var billAdress8 = '';

        // Campos de la direccion
        var col_billadd = ['billingAddress.address1', 'billingAddress.custrecord_lmry_address_number',
          'billingAddress.custrecord_lmry_addr_reference', 'billingAddress.address2',
          'billingAddress.custrecord_lmry_addr_city', 'billingAddress.custrecord_lmry_addr_prov_acronym',
          'billingAddress.zip', 'billingAddress.country'
        ]

        // Busqueda en el record de direcciones
        var busqAddressRece = search.create({
          type: 'transaction',
          columns: col_billadd,
          filters: [
            ["internalid", "anyof", internalId],
            "AND",
            ["mainline", "is", "T"]
          ]
        });

        var resultAddress = busqAddressRece.run().getRange(0, 10);

        if (resultAddress != null && resultAddress.length != 0) {
          row = resultAddress[0].columns;
          //ADDRESS 1
          billAdress1 = resultAddress[0].getValue(row[0]);
          if (billAdress1 == '' || billAdress1 == null) {
            billAdress1 = '';
          }
          //LATAM - ADDRESS NUMBER
          billAdress2 = resultAddress[0].getValue(row[1]);
          if (billAdress2 == '' || billAdress2 == null) {
            billAdress2 = '';
          }

          //LATAM - ADDRESS REFERENCE
          billAdress3 = resultAddress[0].getValue(row[2]);
          if (billAdress3 == '' || billAdress3 == null) {
            billAdress3 = '';
          }

          //ADDRESS 2
          billAdress4 = resultAddress[0].getValue(row[3]);
          if (billAdress4 == '' || billAdress4 == null) {
            billAdress4 = '';
          }

          //LATAM - CITY
          billAdress5 = resultAddress[0].getText(row[4]);
          if (billAdress5 == '' || billAdress5 == null) {
            billAdress5 = '';
          }

          //LATAM - PROVINCE ACRONYM
          billAdress6 = resultAddress[0].getValue(row[5]);
          if (billAdress6 == '' || billAdress6 == null) {
            billAdress6 = '';
          }

          // ZIP
          billAdress7 = resultAddress[0].getValue(row[6]);
          if (billAdress7 == '' || billAdress7 == null) {
            billAdress7 = '';
          }

          billAdress7 = billAdress7.replace(/[^0-9]/g, '');

          //COUNTRY
          billAdress8 = resultAddress[0].getValue(row[7]);
          if (billAdress8 == '' || billAdress8 == null) {
            billAdress8 = '';
          }

        }

        // Arma la direccion completa
        var address_customer = billAdress1 + ' ' + billAdress2 + ' ' +
          billAdress3 + ' ' + billAdress4 + ' ' +
          billAdress5 + ' ' + billAdress6 + ' ' +
          billAdress7 + ' ' + billAdress8;

        if (address_customer) {
          addressCustomer = reemplazarCaracteresEspeciales(address_customer);
          addressCustomer = addressCustomer.substring(0, 140);
        }

      }
      return true;

    }

    function formatoFecha(fecha) {
      try {
        var formatoFecha = '';

        fecha = format.parse({
          value: fecha,
          type: format.Type.DATE
        });

        var day = fecha.getDate();
        day = day.toString();
        if (day.length == 1) {
          day = '0' + day
        }

        var month = fecha.getMonth() + 1;
        month = month.toString();
        if (month.length == 1) {
          month = '0' + month
        }

        var year = fecha.getFullYear();

        formatoFecha = day + '/' + month + '/' + year;
        return formatoFecha;
      } catch (err) {
        libraryMail.sendemail(' [ formatoFecha ] ' + err, LMRY_script);
      }


    }

    //Función que forma el Nosso Numero con 8 digitos
    function formandoNossoNumero(id_invoice, cod) {
      var nossoNumero = '';

      if(cod){
        var cadena = id_invoice+cod;
        nossoNumero = cadena.toString();
      }else{
        nossoNumero = id_invoice.toString();
      }

      while (nossoNumero.length < 8) {
        nossoNumero = '0' + nossoNumero;
      }

      return nossoNumero;
    }

    //Funcion que reemplaza caracteres especiales tales como: <, >, ', ", &
    function reemplazarCaracteresEspeciales(cadena) {
      cadena = cadena.replace(/&gt;/g, '>');
      cadena = cadena.replace(/&lt;/g, '<');
      cadena = xml.escape(cadena);

      return cadena;
    }

    function search_folder() {
      try {
        // ID de la carpeta contenedora de los Boletos Bancarios
        var FolderId = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_boleto_bancario'
        });


        if (FolderId == '' || FolderId == null) {
          // Valida si existe "SuiteLatamReady" en File Cabinet
          var varIdFolderPrimary = '';

          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: ['name', 'is', 'SuiteLatamReady']
          });

          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'SuiteLatamReady');
            varIdFolderPrimary = varRecordFolder.save();
          } else {
            varIdFolderPrimary = objResult[0].getValue('internalid');
          }

          // Valida si existe "Latam BR - PDF Boleto Bancario" en File Cabinet
          var varFolderId = '';
          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: [
              ['name', 'is', 'Latam BR - PDF Boleto Bancario']
            ]
          });
          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'Latam BR - PDF Boleto Bancario');
            varRecordFolder.setValue('parent', varIdFolderPrimary);
            varFolderId = varRecordFolder.save();
          } else {
            varFolderId = objResult[0].getValue('internalid');
          }


          // Load the NetSuite Company Preferences page
          var varCompanyReference = config.load({
            type: config.Type.COMPANY_PREFERENCES
          });

          // set field values
          varCompanyReference.setValue({
            fieldId: 'custscript_lmry_br_boleto_bancario',
            value: varFolderId
          });
          // save changes to the Company Preferences page
          varCompanyReference.save();
        }



      } catch (err) {
        libraryMail.sendemail(' [ search_folder ] ' + err, LMRY_script);
      }
    }

    function formandoInstrucciones(idInvoice) {
      try {
        var valorCustomField = '';
        var vector_custom_field = [];
        vector_custom_field = custom_field.split('|');

        //vector para el SALTO DE LINEA y el TEXTO LIBRE, en este vector se guarda la data junto con su posicion correspondiente
        var vector_data_pos = [];
        //vector para los ID DE LOS CAMPOS DE TIPO CUSTBODY, en este vector se guarda la data junto con su posicion correspondiente
        var vector_id = [];


        for (var t = 0; t < vector_custom_field.length; t++) {
          //Si contiene la palabra enter, se realizará un salto de linea
          if ((vector_custom_field[t]).toLowerCase() == 'enter') {
            var enter = '<br/>'
            vector_data_pos[t] = enter;

          } else {
            var ultimaPos = vector_custom_field[t].length;
            //Si la palabra esta dentro de llaves, son ID de los campos tipo custbody
            if (vector_custom_field[t].substring(0, 1) == '{' && vector_custom_field[t].substring(ultimaPos - 1, ultimaPos) == '}') {
              vector_id[t] = vector_custom_field[t].substring(1, ultimaPos - 1);
            }
            //Si la palabra esta dentro de corchetes, son texto Libre
            if (vector_custom_field[t].substring(0, 1) == '[' && vector_custom_field[t].substring(ultimaPos - 1, ultimaPos) == ']') {
              var textoLibre = vector_custom_field[t].substring(1, ultimaPos - 1);
              vector_data_pos[t] = textoLibre;
            }
          }

        }

        var vector_cadena_final = [];

        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: idInvoice,
          columns: vector_id
        });

        for (var pos = 0; pos < vector_id.length; pos++) {
          if (vector_id[pos]) {

            var name_id = vector_id[pos];
            var valor_id = recordInvoice[name_id];
            var type_valor_id = typeof valor_id;

            if (type_valor_id == 'object' && recordInvoice[name_id] != null && recordInvoice[name_id] != '') {
              valor_id = recordInvoice[name_id][0].text;
              valor_id = reemplazarCaracteresEspeciales(valor_id);

              vector_cadena_final[pos] = valor_id;
            }

          }
        }

        //Guardando los valores de linea de salto y los valores de texto fijo
        for (var pos = 0; pos < vector_data_pos.length; pos++) {

          var enter_textoFijo = vector_data_pos[pos];

          if (enter_textoFijo == '<br/>') {
            vector_cadena_final[pos] = enter_textoFijo;
          }
          if (enter_textoFijo != '' && enter_textoFijo != null && enter_textoFijo != '<br/>') {
            enter_textoFijo = reemplazarCaracteresEspeciales(enter_textoFijo);
            vector_cadena_final[pos] = enter_textoFijo;

          }
        }

        valorCustomField = vector_cadena_final.join(' ');
        return valorCustomField;

      } catch (err) {
        libraryMail.sendemail(' [ formandoInstrucciones ] ' + err, LMRY_script);
      }
    }

    function obtenerFactorVencimiento() {
      try {
        var diferenciaDias = '';
        var fechaBase = new Date('1997/10/07'); //Fecha Base (año mes dia)

        var fechaVencimiento = format.parse({
          value: dataVencimiento,
          type: format.Type.DATE
        });

        var resta = fechaVencimiento.getTime() - fechaBase.getTime();
        diferenciaDias = Math.round(resta / (1000 * 60 * 60 * 24));

        while (diferenciaDias > 9999) {
          diferenciaDias = diferenciaDias - 9000;
        }

        var diferenciaDiasString = diferenciaDias.toString();
        while (diferenciaDiasString.length < 4) {
          diferenciaDiasString = "0" + diferenciaDiasString
        }

        return diferenciaDiasString;
      } catch (err) {
        libraryMail.sendemail(' [ obtenerFactorVencimiento ] ' + err, LMRY_script);
      }

    }

    function obtenerSumaDigitosNumero(numero) {
      var suma = 0;
      var numeroString = numero.toString();
      var i;

      for (i = 0; i < numeroString.length; i++) {
        var digito = numeroString[i];
        digito_int = parseInt(digito);
        suma = suma + digito_int;
      }
      return suma;

    }

    function obtenerDigitoVerificadorCriterioMod10(campo) {
      try {
        var digVerificador = '';
        var v = [];
        var i, j;
        var digMulti;
        var suma = 0;

        for (i = campo.length - 1; i >= 0; i--) {
          digito = campo[i];
          digito_int = parseInt(digito);
          v.push(digito_int);
        }

        for (j = 0; j < v.length; j++) {

          if (j % 2 == 0) {
            digMulti = v[j] * 2;
            digMulti = obtenerSumaDigitosNumero(digMulti);
          } else {
            digMulti = v[j] * 1;
            digMulti = obtenerSumaDigitosNumero(digMulti);

          }
          suma = suma + digMulti;

        }
        var resto = suma % 10;

        digVerificador = 10 - resto;
        if (digVerificador == 10) {
          digVerificador = 0;
        }

        return digVerificador;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDigitoVerificadorCriterioMod10 ] ' + err, LMRY_script);
      }
    }

    //El código de barras esta formado por 44 posiciones
    function obtenerCodigoBarras(monto) {
      try {
        var codBarras = '';
        var digitoVerificadorCB = '';
        var factorVencimiento = '';
        var valorBoletoBancario = '';
        var factorVencimiento_ValorBB = '';

        //Para la obtencion del Factor de Vencimiento es necesario que no este vacio el campo de la fecha de vencimiento "DUE DATE" del invoice
        if (dataVencimiento) {
          factorVencimiento = obtenerFactorVencimiento();
        }else{
          factorVencimiento = '0000';
        }

        var valor_BoletoBancario = monto.toString();

        //Reemplaza el punto , el espacio en blanco y la coma por sin espacio, de manera global
        valorBoletoBancario = valor_BoletoBancario.replace(/\.| |\,/g, '');

        if (valorBoletoBancario.length > 10) {
          while (valorBoletoBancario.length < 14) {
            valorBoletoBancario = "0" + valorBoletoBancario
          }
          factorVencimiento_ValorBB = valorBoletoBancario;

        } else {
          while (valorBoletoBancario.length < 10) {
            valorBoletoBancario = "0" + valorBoletoBancario;
          }
          factorVencimiento_ValorBB = factorVencimiento + valorBoletoBancario;
        }

        var codBeneficiario = codigoBeneficiario.split('-');

        if (cartera == 126 || cartera == 131 || cartera == 146 || cartera == 150 || cartera == 168) {
          var carteraNossoNumeroDAC = cartera.toString() + nossoNum;
          dacPosicion31 = obtenerDigitoVerificadorCriterioMod10(carteraNossoNumeroDAC);
        } else {
          var agenCodBenefCarteraNossoNumDAC = agencia.toString() + codBeneficiario[0] + cartera.toString() + nossoNum;

          dacPosicion31 = obtenerDigitoVerificadorCriterioMod10(agenCodBenefCarteraNossoNumDAC);
        }
        var librePosicion = '000';

        // codigoBanco(341) + codigoMoneda(9)
        var cb_parte1 = codigoBanco.toString() + codigoMoneda.toString();
        //factorVencimiento_ValorBB(14 digitos) + cartera(3 dig) + nossoNum(8 dig) + DACPosicion(1 dig) + agencia(4 dig) + ContaCorrente(5 dig) + DACContaCorrente(1 dig) + 000
        var cb_parte2 = factorVencimiento_ValorBB + cartera.toString() + nossoNum + dacPosicion31 + agencia.toString() + codBeneficiario[0] + codBeneficiario[1] + librePosicion;
        var cb = cb_parte1 + cb_parte2;

        var digito = '';
        var digito_int = '';

        var i, j;
        var vector = [];

        for (i = cb.length - 1; i >= 0; i--) {
          digito = cb[i];
          digito_int = parseInt(digito);
          vector.push(digito_int);
        }

        var suma = 0;
        var digitoMultiplicado;
        var t = 2;

        for (j = 0; j < vector.length; j++) {

          if (t <= 9) {
            digitoMultiplicado = vector[j] * t;
            t++;

          } else {
            t = 2;
            digitoMultiplicado = vector[j] * t;
            t++;
          }

          var suma = suma + digitoMultiplicado;

        }

        var resto = suma % 11;
        digitoVerificadorCB = 11 - resto;

        if (digitoVerificadorCB == 0 || digitoVerificadorCB == 1 || digitoVerificadorCB == 10 || digitoVerificadorCB == 11) {
          digitoVerificadorCB = 1;
        }


        codBarras = cb_parte1 + digitoVerificadorCB + cb_parte2;

        return codBarras;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerCodigoBarras ] ' + err, LMRY_script);
      }
    }

    //Linea digital: Representación Numerica del Codigo de Barras
    function obtenerLineaDigital(codigoDeBarras) {
      try {
        var linDigital = '';
        var digVerificador1 = '';
        var digVerificador2 = '';
        var digVerificador3 = '';

        //var longitud = codigoDeBarras.length;
        var campo1 = codigoDeBarras.substring(0, 4); //3419
        var campo2 = codigoDeBarras.substring(4, 5); //Digito Verificador del codigo de Barras
        var campo3 = codigoDeBarras.substring(5, 19); //FactorVencimiento(4 digitos) + valorTitulo(10 digitos)
        var campo4 = codigoDeBarras.substring(19, 24); // cartera(3 digitos) + NossoNumero(los 2 primeros digitos)
        var campo5 = codigoDeBarras.substring(24, 34); // NossoNumero(restantes 6 digitos) + pos31(1 digito) + Agencia(los 3 primeros digitos)
        var campo6 = codigoDeBarras.substring(34, 44); // Agencia(resta 1 digito) + codBeneficiario(6 digitos) + ceros (3 digitos)

        var campo_1_4 = campo1 + campo4;
        digVerificador1 = obtenerDigitoVerificadorCriterioMod10(campo_1_4);
        digVerificador2 = obtenerDigitoVerificadorCriterioMod10(campo5);
        digVerificador3 = obtenerDigitoVerificadorCriterioMod10(campo6);

        //La linea digital posee 5 campos:
        //Campo1: 3419 + cartera(3 digitos) + NossoNumero(los 2 primeros digitos)
        var dig1_campo4 = campo4.substring(0, 1);
        var dig2_campo4 = campo4.substring(1, 5);
        var nuevo_campo4 = dig1_campo4 + "." + dig2_campo4;

        //Campo2: NossoNumero(restantes 6 digitos) + pos31(1 digito) + Agencia(los 3 primeros digitos)
        var dig1_campo5 = campo5.substring(0, 5);
        var dig2_campo5 = campo5.substring(5, 10);
        var nuevo_campo5 = dig1_campo5 + "." + dig2_campo5;

        //Campo3: Agencia(resta 1 digito) + codBeneficiario(6 digitos) + ceros (3 digitos)
        var dig1_campo6 = campo6.substring(0, 5);
        var dig2_campo6 = campo6.substring(5, 10);
        var nuevo_campo6 = dig1_campo6 + "." + dig2_campo6;


        //Campo4-->DV del codigo de Barras      campo5--->FactorVencimiento(4 digitos) + valorTitulo(10 digitos)
        linDigital = campo1 + nuevo_campo4 + digVerificador1 + " " + nuevo_campo5 + digVerificador2 + " " + nuevo_campo6 + digVerificador3 + " " + campo2 + " " + campo3;

        return linDigital;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerLineaDigital ] ' + err, LMRY_script);
      }
    }

    function obtenerEspecieDOC(id_invoice) {
      try {
        //Busqueda del record customrecord_lmry_br_transaction_fields para obtener las siglas del campo Document Especie de un invoice determinado
        var searchBRTransactionFields = search.create({
          type: 'customrecord_lmry_br_transaction_fields',
          columns: [{
              name: "custrecord_lmry_br_docu_specie_siglas",
              join: "CUSTRECORD_LMRY_BR_DOCUMENT_SPECIE",
              label: "BR Siglas"
            }

          ],
          filters: ['custrecord_lmry_br_related_transaction', 'is', id_invoice]
        });
        searchResult = searchBRTransactionFields.run().getRange(0, 1);
        if (searchResult != '' && searchResult != null) {
          var columns = searchResult[0].columns
          var siglas_documentoEspecie = searchResult[0].getValue(columns[0]);
          if (siglas_documentoEspecie)
            especieDoc = siglas_documentoEspecie;
        }
      } catch (err) {
        libraryMail.sendemail(' [ obtenerEspecieDOC ] ' + err, LMRY_script);

      }

    }

    return {
      obtenerURLPdfBoletoBancarioITAU: obtenerURLPdfBoletoBancarioITAU
    };

  });
